import { ai, GEMINI_MODELS } from '../src/services/ai/gemini';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

// Gemini 2.5 Flash Context Window Limit (1,048,576 tokens)
const CONTEXT_WINDOW_LIMIT = 1_048_576;

// Pricing per million tokens (Gemini 2.5 Flash on Vertex AI)
const INPUT_PRICE_PER_M = 0.075; // $0.075 per 1M input tokens
const OUTPUT_PRICE_PER_M = 0.30;  // $0.30 per 1M output tokens

let sessionTotalTokens = 0;
let sessionTotalCost = 0;

function createProgressBar(used: number, total: number, barLength = 15): string {
  const fraction = Math.min(used / total, 1);
  const filledChars = Math.round(fraction * barLength);
  const emptyChars = barLength - filledChars;
  return '█'.repeat(filledChars) + '░'.repeat(emptyChars);
}

async function startChat() {
  let chat = ai.chats.create({
    model: GEMINI_MODELS.FLASH,
    config: {
      systemInstruction: 'You are a helpful, expert AI software engineer and dairy business consultant.',
    },
  });

  const rl = readline.createInterface({ input, output });

  console.log('====================================================');
  console.log('🤖 Gemini Interactive Chat (Vertex AI $300 Credit)');
  console.log(`Context Window: ${CONTEXT_WINDOW_LIMIT.toLocaleString()} tokens`);
  console.log('Commands:');
  console.log('  • Type "/reset" to clear memory & reset token window');
  console.log('  • Type "exit" to quit');
  console.log('====================================================\n');

  while (true) {
    const userMessage = await rl.question('You > ');

    if (!userMessage.trim()) continue;

    // Reset conversation memory
    if (userMessage.trim().toLowerCase() === '/reset') {
      chat = ai.chats.create({
        model: GEMINI_MODELS.FLASH,
        config: {
          systemInstruction: 'You are a helpful, expert AI software engineer and dairy business consultant.',
        },
      });
      console.log('\n🔄 Chat context memory reset! Tokens left: 1,048,576 (100% capacity free)\n');
      continue;
    }

    // Exit
    if (['exit', 'quit', 'q'].includes(userMessage.trim().toLowerCase())) {
      console.log('\n================ Session Summary ================');
      console.log(`Total Tokens Processed : ${sessionTotalTokens.toLocaleString()}`);
      console.log(`Total Cost Deducted    : $${sessionTotalCost.toFixed(6)}`);
      console.log('=================================================');
      console.log('Goodbye! 👋\n');
      rl.close();
      break;
    }

    process.stdout.write('Gemini is thinking...');

    try {
      const response = await chat.sendMessage({
        message: userMessage,
      });

      // Clear "thinking..." line
      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 0);
      console.log(`Gemini > ${response.text}\n`);

      // Usage & Context Calculations
      const usage = response.usageMetadata;
      if (usage) {
        const inputTokens = usage.promptTokenCount || 0;
        const outputTokens = usage.candidatesTokenCount || 0;
        const currentContextTokens = inputTokens + outputTokens;

        // Cost
        const promptCost = (inputTokens / 1_000_000) * INPUT_PRICE_PER_M;
        const candidateCost = (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_M;
        const requestCost = promptCost + candidateCost;

        sessionTotalTokens += currentContextTokens;
        sessionTotalCost += requestCost;

        // Context Window Capacity
        const tokensLeft = Math.max(0, CONTEXT_WINDOW_LIMIT - currentContextTokens);
        const percentUsed = ((currentContextTokens / CONTEXT_WINDOW_LIMIT) * 100).toFixed(2);
        const percentLeft = (100 - Number(percentUsed)).toFixed(2);
        const progressBar = createProgressBar(currentContextTokens, CONTEXT_WINDOW_LIMIT);

        console.log('----------------------------------------------------');
        console.log(`📊 Message Cost : ~$${requestCost.toFixed(6)} (Session Total: ~$${sessionTotalCost.toFixed(6)})`);
        console.log(`🧠 Window Used  : ${currentContextTokens.toLocaleString()} / ${CONTEXT_WINDOW_LIMIT.toLocaleString()} tokens [${progressBar}] ${percentUsed}%`);
        console.log(`⏳ Tokens Left  : ${tokensLeft.toLocaleString()} tokens remaining (${percentLeft}% capacity free)`);
        console.log('----------------------------------------------------\n');
      }
    } catch (error: any) {
      console.log('\n');
      console.error('Error:', error.message || error);
    }
  }
}

startChat().catch(console.error);
