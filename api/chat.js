/**
 * Vercel Serverless Function: /api/chat
 * Handles ChatBuddy intent classification and conversations.
 */

import { processChatBuddyMessage } from '../backend/services/chatBuddyLlmService.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { message, history } = req.body || {};

  if (typeof message !== 'string') {
    return res.status(400).json({
      type: 'chat',
      action: 'none',
      params: {},
      reply: 'Message is required and must be a string'
    });
  }

  try {
    const result = await processChatBuddyMessage({
      message,
      history: Array.isArray(history) ? history : []
    });

    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({
      type: 'chat',
      action: 'none',
      params: {},
      reply: 'Main connect nahi ho paayi, kripya dobara try karein!'
    });
  }
}

