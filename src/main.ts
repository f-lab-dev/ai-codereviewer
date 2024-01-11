import { readFileSync } from "fs";
import * as core from "@actions/core";
import OpenAI from "openai";
import { Octokit } from "@octokit/rest";
import parseDiff, { Chunk, File } from "parse-diff";
import minimatch from "minimatch";
import { createInstance } from "./api/axiosConfig";
import { getPrompt } from "./api/getPrompt";

const GITHUB_TOKEN: string = core.getInput("GITHUB_TOKEN");
const OPENAI_API_KEY: string = core.getInput("OPENAI_API_KEY");
const FLAB_SECRET_KEY: string = core.getInput("FLAB_SECRET_KEY");

const MAX_RETRY_COUNT = 1;

const octokit = new Octokit({ auth: GITHUB_TOKEN });

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

interface PRDetails {
  owner: string;
  repo: string;
  pull_number: number;
  title: string;
  description: string;
}

async function getPRDetails(): Promise<PRDetails> {
  const { repository, number } = JSON.parse(
    readFileSync(process.env.GITHUB_EVENT_PATH || "", "utf8")
  );
  const prResponse = await octokit.pulls.get({
    owner: repository.owner.login,
    repo: repository.name,
    pull_number: number,
  });
  return {
    owner: repository.owner.login,
    repo: repository.name,
    pull_number: number,
    title: prResponse.data.title ?? "",
    description: prResponse.data.body ?? "",
  };
}

async function getDiff(
  owner: string,
  repo: string,
  pull_number: number
): Promise<string | null> {
  const response = await octokit.pulls.get({
    owner,
    repo,
    pull_number,
    mediaType: { format: "diff" },
  });
  // @ts-expect-error - response.data is a string
  return response.data;
}

async function analyzeCode(
  parsedDiff: File[],
  prDetails: PRDetails,
  flabApiResponse: {
    prompt: string;
    model: string;
  },
  branchName: string,
): Promise<Array<{ body: string; path: string; line: number }>> {
  const filteredDiff = parsedDiff.filter((file) => {
    return file.to !== "/dev/null";
  });

  const fullContents: Array<string> = [];
  const diffs: Array<string> = [];
  for (const file of filteredDiff) {
    const fullFileContent = await octokit.repos.getContent({
      headers: {
        accept: "application/vnd.github.raw",
      },
      owner: prDetails.owner,
      repo: prDetails.repo,
      path: file.to!!,
      ref: branchName,
    });
    fullContents.push(`filePath : ${file.to}\n` + '```\n' + String(fullFileContent.data) + '\n```');

    diffs.push(`filePath : ${file.to}\n` +
      file.chunks.map((chunk) => {
        return `\`\`\`diff
${chunk.changes
          // @ts-expect-error - ln and ln2 exists where needed
          .map((c) => `${c.ln ? c.ln : c.ln2} ${c.content}`)
          .join("\n")}
\`\`\`
`;
      }).join('\n')
    )
  }
  const fullContent = fullContents.join('\n\n');
  const diff = diffs.join('\n\n');

  const prompt = flabApiResponse.prompt
    .replace('#{prTitle}', prDetails.title)
    .replace('#{prDescription}', prDetails.description)
    .replace('#{fullContent}', fullContent)
    .replace('#{diff}', diff);

  console.log(prompt);
  console.log('------------------------');

  const aiResponse = await getAIResponse(prompt, flabApiResponse.model);

  if (!aiResponse) {
    throw new Error("AI response is null");
  }

  return aiResponse;
}

function createPrompt(basePrompt: string, file: File, chunk: Chunk, prDetails: PRDetails, fullFileContent: string): string {

  return basePrompt.replace(/#\{(.*?)\}/g, (match, p1) => {
    const parts = p1.split('.');
    let current: any = { file, chunk, prDetails, fullFileContent };

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return match;
      }
    }

    if (p1 === 'chunk.changes' && Array.isArray(current)) {
      return current
          .map(c => `${c.ln ? c.ln : c.ln2} ${c.content}`)
          .join("\n");
    }

    return current;
  });
}

async function getAIResponse(
  prompt: string,
  model: string
): Promise<Array<{ body: string; path: string; line: number }> | null> {
  const queryConfig = {
    model: model,
    temperature: 0.2,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  };

  try {
    const response = await openai.chat.completions.create({
      ...queryConfig,
      // return JSON if the model supports it:
      ...(model === "gpt-4-1106-preview"
        ? { response_format: { type: "json_object" } }
        : {}),
      messages: [
        {
          role: "system",
          content: prompt,
        },
      ],
    });

    const res = response.choices[0].message?.content?.trim() || "{}";
    console.log(res);
    return JSON.parse(res).reviews;
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

function createComment(
  file: File,
  chunk: Chunk,
  aiResponses: Array<{
    lineNumber: string;
    reviewComment: string;
  }>
): Array<{ body: string; path: string; line: number }> {
  return aiResponses.flatMap((aiResponse) => {
    if (!file.to) {
      return [];
    }
    return {
      body: aiResponse.reviewComment,
      path: file.to,
      line: Number(aiResponse.lineNumber),
    };
  });
}

async function createReviewComment(
  owner: string,
  repo: string,
  pull_number: number,
  comments: Array<{ body: string; path: string; line: number }>
): Promise<void> {
  await octokit.pulls.createReview({
    owner,
    repo,
    pull_number,
    comments,
    event: "COMMENT",
  });
}

async function main() {
  const prDetails = await getPRDetails();
  let diff: string | null;
  const eventData = JSON.parse(
    readFileSync(process.env.GITHUB_EVENT_PATH ?? "", "utf8")
  );
  const branchName = eventData.pull_request.head.ref;

  if (eventData.action === "opened" || eventData.action === "reopened") {
    diff = await getDiff(
      prDetails.owner,
      prDetails.repo,
      prDetails.pull_number
    );
  } else if (eventData.action === "synchronize") {
    const newBaseSha = eventData.before;
    const newHeadSha = eventData.after;

    const response = await octokit.repos.compareCommits({
      headers: {
        accept: "application/vnd.github.v3.diff",
      },
      owner: prDetails.owner,
      repo: prDetails.repo,
      base: newBaseSha,
      head: newHeadSha,
    });

    diff = String(response.data);
  } else {
    console.log("Unsupported event:", process.env.GITHUB_EVENT_NAME);
    return;
  }

  if (!diff) {
    console.log("No diff found");
    return;
  }

  const apiClient = createInstance({
      customKey: FLAB_SECRET_KEY
     })

  const {prompt, model} = await getPrompt(apiClient);

  const flabApiResponse = {
    prompt,
    model
  }

  const parsedDiff = parseDiff(diff);

  const excludePatterns = core
    .getInput("exclude")
    .split(",")
    .map((s) => s.trim());

  const filteredDiff = parsedDiff.filter((file) => {
    return !excludePatterns.some((pattern) =>
      minimatch(file.to ?? "", pattern)
    );
  });

  // if (filteredDiff.length > 10) {
  //   await octokit.issues.createComment({
  //     owner: prDetails.owner,
  //     repo: prDetails.repo,
  //     issue_number: prDetails.pull_number,
  //     body: '변경된 파일이 10개를 초과하여 AI 코드리뷰가 제공되지 않습니다.\n\nPR의 크기는 작게 유지해주세요.',
  //   });
  //   return;
  // }

  for (let i = 0; i < MAX_RETRY_COUNT; i++) {
    try {
      const comments = await analyzeCode(filteredDiff, prDetails, flabApiResponse, branchName);
      if (comments.length > 0) {
        await createReviewComment(
          prDetails.owner,
          prDetails.repo,
          prDetails.pull_number,
          comments
        );
      }
      return;
    } catch (error) {
      if (i === MAX_RETRY_COUNT - 1) {
        throw error;
      }
    }
  }
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function replaceAll(str: string, find: string, replace: string) {
  return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
