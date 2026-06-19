const axios = require('axios');

/**
 * Service to generate plain language explanations of risk decisions.
 * Integrates with LLM API (OpenAI/Anthropic/Gemini) or falls back to standard templates.
 */
const generateRiskExplanation = async (riskData) => {
  const { finalScore, mlScore, violations } = riskData;

  const prompt = `You are a Bank of Baroda identity trust assistant explaining a security decision to a fraud analyst or customer.
Risk score: ${finalScore}/100 (higher = more risky).
Behavioral anomaly probability: ${Math.round(mlScore * 100)}%.
Contributing factors:
${violations.length > 0 ? violations.map(v => `- ${v.desc} (${v.weight > 0 ? '+' : ''}${v.weight} points)`).join('\n') : '- No elevated risk factors detected'}

Write a clear, professional explanation in 2-3 sentences:
1. State why the trust level changed (device, location, behavior, or employee activity).
2. State the recommended action (Allow Access, OTP Verification, Face Verification, or Block and Escalate).
Use plain banking language — no technical jargon.`;

  // Fallback Rule-Based Explainer (Explainable AI module)
  const localExplain = () => {
    let factors = [];
    
    if (violations && violations.length > 0) {
      violations.forEach(v => {
        factors.push(`${v.desc} (+${v.weight})`);
      });
    }

    if (mlScore > 0.6) {
      factors.push(`Behavioral Biometrics Anomaly (+25)`);
    } else if (mlScore > 0 && mlScore <= 0.3) {
      factors.push(`Trusted Behavioral Cadence (-10)`);
    }

    let decisionText = "Allow Access";
    if (finalScore > 80) {
      decisionText = "Block and Escalate";
    } else if (finalScore > 60) {
      decisionText = "Face Verification Required";
    } else if (finalScore > 30) {
      decisionText = "OTP Verification Required";
    }

    const factorsStr = factors.length > 0 ? factors.join(', ') : 'Verified Baselines (-10)';
    return `Risk Score: ${finalScore}/100. Contributing Factors: ${factorsStr}. Final Decision: ${decisionText}.`;
  };

  // Attempt to call LLMs if API keys are available in environment variables
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 150,
            temperature: 0.3
          }
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 4000
        }
      );
      if (response.data && response.data.candidates && response.data.candidates[0] && 
          response.data.candidates[0].content && response.data.candidates[0].content.parts && 
          response.data.candidates[0].content.parts[0] && response.data.candidates[0].content.parts[0].text) {
        return response.data.candidates[0].content.parts[0].text.trim();
      }
    } catch (e) {
      console.warn("Gemini API call failed or timed out. Checking alternative LLMs...");
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 150,
          temperature: 0.3
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          timeout: 4000
        }
      );
      return response.data.choices[0].message.content.trim();
    } catch (e) {
      console.warn("OpenAI API call failed or timed out. Checking alternative LLMs...");
    }
  }
  
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-haiku-20240307',
          max_tokens: 150,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          timeout: 4000
        }
      );
      return response.data.content[0].text.trim();
    } catch (e) {
      console.warn("Anthropic API call failed or timed out. Falling back to local rule-based explainer.");
    }
  }

  // Fallback to explainable rules
  return localExplain();
};

module.exports = {
  generateRiskExplanation
};
