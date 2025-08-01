    }

    const userPrompt = prompt || 'Rewrite each item into a podcast segment. Tone: British Gen X, confident, dry wit. Each segment should sound natural and flow.';
    const temp = (typeof temperature === 'number') ? temperature : 0.8;

    const ssmlRules = ' For each item, produce one SSML chunk. Wrap with <speak>...</speak>. Say "AI" as <say-as interpret-as="characters">A I</say-as>. Use <emphasis> and <break time="600ms"/> naturally. Each chunk must be JSON-safe, single-line (no raw newlines), and under 4800 characters. Output ONLY the chunks, one per line.';

    const finalPrompt = userPrompt + ssmlRules + '\n\nItems:\n- ' + stories.join('\n- ');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: finalPrompt }],
      temperature: temp
    });

    const raw = completion.choices[0].message.content.trim();
    const lines = raw.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
    const chunks = lines.map(line => line.replace(/\s+/g, ' ').trim());

    res.json({ chunks });
  } catch (err) {
    console.error('Main generation failed:', err);
    res.status(500).json({ error: 'Main generation error', details: err.message });
  }
});

module.exports = router;
                          
