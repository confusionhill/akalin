---
title: 'I Built My Mom a WhatsApp AI Assistant. It Went Horribly Wrong.'
description: 'What building an agentic chatbot for the least technical person I know taught me about prompt evaluation, testing, and why vibes-based QA will ruin your weekend.'
pubDate: '2026-08-07'
heroImage: '/lessons-learned.png'
draft: true
---

# I Built My Mom a WhatsApp AI Assistant. It Went Horribly Wrong.

It started as a weekend project.

My mom runs a small business. She spends hours every day replying to the same WhatsApp messages "How much is this?", "Can you do 50 units for Saturday?", "Do you deliver to Pekanbaru?", so I thought, why not build her an AI assistant?

The plan was simple: an agentic WhatsApp bot that could answer product questions, check availability, calculate pricing, and even confirm orders. I'd hook it up to a spreadsheet for her catalog, give it a system prompt with her business rules, and let it run.

How hard could it be?

---

## Week 1: "It Works!"

I got a prototype running in a few days. The bot could read her product spreadsheet, answer pricing questions, and respond in Bahasa Indonesia with the warm, friendly tone my mom uses with her customers.

I tested it with maybe ten messages. The responses looked great. I showed my mom. She was thrilled. I deployed it.

**This was my first mistake.**

---

## Week 2: The Pricing Disaster

My mom called me on a Tuesday morning, panicking. A customer had placed a bulk order of 100 units for a corporate event. The bot quoted Rp 15,000 per unit. Her actual price for bulk orders over 50 is Rp 25,000 per unit because of the extra handling and packaging.

The bot had hallucinated a discount that didn't exist.

I checked the prompt. It said: "Refer to the product spreadsheet for pricing." But the spreadsheet only had per-unit prices — there was no bulk pricing logic. The model filled in the gap with a made-up volume discount because that's what "seemed reasonable."

I patched the prompt with explicit pricing rules. I tested it with three bulk order queries. It looked fine. I redeployed.

**I did not test whether the fix broke regular pricing queries. It did.**

For two days, the bot was quoting Rp 25,000 for single-unit orders — scaring off casual customers. My mom didn't tell me because she thought she was "bothering me."

---

## Week 3: The Tool Calling Fiasco

The bot had access to two tools: one to look up the menu spreadsheet and one to check delivery availability by area. Simple enough.

One morning, a customer asked: "Do you deliver to Bogor and what's the minimum order?"

The bot called the delivery tool correctly. Then, instead of calling the catalog tool for the minimum order info, it hallucinated the answer: "Minimum order is 10 units." My mom's actual minimum is 20 for delivery.

The customer placed an order for 12 units. My mom had to call them back and explain. She was embarrassed. I was mortified.

The problem wasn't the tools — they worked fine individually. The problem was that the agent decided it already "knew" the answer and skipped the tool call entirely. I had no way to verify tool calling behavior across different query combinations without testing each one manually.

**I started keeping a list of "queries that broke things." I didn't realize it yet, but I was building my first test suite.**

---

## Week 4: The Language Meltdown

My mom's customers mostly write in Bahasa Indonesia, but some mix in Sundanese or English. The bot handled Bahasa fine. English was okay. But Sundanese? The bot would panic and respond with a weird mix of formal Indonesian and English that sounded like a government chatbot having an identity crisis.

I added instructions to the prompt: "If the customer writes in Sundanese, respond warmly in Bahasa Indonesia." I tested it with one Sundanese message. It worked.

I didn't test what happened when a customer *switched* languages mid-conversation. Turns out, the memory context confused the model. After a Sundanese message, the bot would keep responding in overly formal Indonesian for the rest of the conversation — even when the customer switched back to casual Bahasa.

**Multi-turn behavior is a different beast. Testing single messages tells you almost nothing about how the agent behaves in a real conversation.**

---

## The Breaking Point

After a month of weekend firefighting, I had:

- A growing spreadsheet of "messages that broke the bot" (47 rows and counting)
- A system prompt that had been patched so many times it read like spaghetti code
- A mom who was losing trust in the whole thing and had started replying to customers manually again
- Zero confidence that any change I made wouldn't break something else

I was spending more time fixing the bot than the bot was saving her.

That's when I sat down and asked myself the question I should have asked on day one:

> "How do I know if this prompt is actually working?"

---

## What I Built Next

I stopped patching and started building a proper evaluation pipeline:

1. **I turned my "things that broke" spreadsheet into test cases.** Each row became an input-output pair with expected behavior: correct price, correct tool called, correct language, correct tone.

2. **I wrote an evaluation rubric.** Not "does it look right?" but specific criteria: pricing accuracy, tool usage correctness, language consistency, tone warmth. Each scored on a scale.

3. **I automated the scoring.** I used a stronger model as the evaluator to grade the bot's responses against my rubric. No more squinting at outputs.

4. **I set a threshold.** If the average score dropped below 0.8 on any criteria, the prompt change didn't ship.

5. **I version-controlled the prompt.** Every change was tracked. Every evaluation run was recorded with which prompt version was used and what the scores were.

The first time I ran my 47 test cases against the production prompt, it scored 0.62 overall. I had been shipping a prompt that failed more than a third of my own test cases.

Within two weeks of iterating with the pipeline, the score hit 0.91. My mom started trusting the bot again. I stopped getting panicked Tuesday morning calls.

---

## The Lesson

Building an AI agent is easy. Building one that works reliably in production — where real people depend on it and real money is involved — is brutally hard. Not because the technology is bad, but because **we don't test it the way it deserves to be tested.**

If I had started with a proper evaluation pipeline from day one, I would have caught the bulk pricing hallucination before my mom's customer did. I would have caught the tool-skipping behavior before someone ordered 12 boxes. I would have caught the language meltdown before my mom got embarrassed in front of her regulars.

The tools and the models are good enough. The missing piece was always evaluation.

---

## You Probably Have a "Mom's WhatsApp Bot" Too

Maybe yours is a customer support agent, or a sales copilot, or an internal knowledge assistant. The specifics don't matter. If you're shipping AI to real users without a systematic way to test it, you are exactly where I was — one hallucinated price quote away from a very bad day.

Don't wait for the phone call. Set up evaluation first. [Start with Akalin →](/)
