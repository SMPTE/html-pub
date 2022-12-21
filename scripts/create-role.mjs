/* (c) Society of Motion Picture and Television Engineers

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software without
   specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

import * as process from "process";
import { IAMClient, CreatePolicyCommand, CreateRoleCommand, AttachRolePolicyCommand } from "@aws-sdk/client-iam";

const client = new IAMClient({ region: "us-east-1" });

if (process.argv.length != 3)
  throw "Name of repo is missing"

const repoName = process.argv[2];


if (!/[a-z-]+/.test(repoName))
   throw "Invalid repo name"

const roleName = `gh-actions-${repoName}`;

const assumeRolePolicyDoc = {
   Version: "2012-10-17",
   Statement: {
      Effect: "Allow",
      Action: "sts:AssumeRoleWithWebIdentity",
      Principal: {
         Federated: "arn:aws:iam::189079736792:oidc-provider/token.actions.githubusercontent.com"
      },
      Condition: {
         StringLike: {
            "token.actions.githubusercontent.com:sub": `repo:SMPTE/${repoName}:*`
         },
         StringEquals:  {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
         }
      }
   }
}

let response = await client.send(new CreateRoleCommand ({
   RoleName: roleName,
   AssumeRolePolicyDocument: JSON.stringify(assumeRolePolicyDoc),
   Tags: [{Key: "project", Value: "html-pub"}]
}));

console.log(response);

const policyName = `pub-worker-${repoName}`;

const policyDoc = {
   Version: "2012-10-17",
   Statement: {
      Effect: "Allow",
      Action: "s3:PutObject",
      Resource: `arn:aws:s3:::html-doc-pub/staging/${repoName}/*`
   }
}

response = await client.send(new CreatePolicyCommand({
   PolicyName: policyName,
   PolicyDocument: JSON.stringify(policyDoc),
   Tags: [{Key: "project", Value: "html-pub"}]
}));

console.log(response);

const policyArn = response.Policy.Arn;

response = await client.send(new AttachRolePolicyCommand({
   PolicyArn: policyArn,
   RoleName: roleName
}));

console.log(response);
