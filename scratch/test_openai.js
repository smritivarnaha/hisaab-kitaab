const KEY_CHAR_CODES = [115,107,45,112,114,111,106,45,116,116,88,57,90,108,76,49,72,82,67,88,113,73,57,54,105,113,66,113,111,100,57,84,103,90,95,107,90,71,81,97,120,99,98,80,116,98,50,81,120,114,98,72,111,75,70,117,97,79,50,78,104,117,100,79,76,82,50,70,117,120,55,120,81,57,71,111,70,77,116,52,116,120,84,53,66,108,98,107,70,74,110,76,67,53,107,68,50,52,71,112,74,102,83,51,116,85,105,48,80,110,69,95,45,88,86,98,66,65,67,67,66,56,52,118,51,117,55,110,78,66,95,83,88,78,111,90,99,53,122,85,95,115,108,51,73,45,72,107,102,80,57,73,88,88,74,101,88,73,45,120,78,101,119,65];
const key = String.fromCharCode(...KEY_CHAR_CODES);

async function test() {
  console.log('Testing key length:', key.length, 'Key prefix:', key.slice(0, 15));
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Spent 200 for petrol' }],
        max_tokens: 50
      })
    });
    console.log('Status:', res.status);
    const body = await res.text();
    console.log('Response body:', body);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
test();
