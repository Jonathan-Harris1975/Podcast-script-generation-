const express = require('express');
const router = express.Router();
const oneLine = s => String(s||'').replace(/\r?\n/g,' ').replace(/\s+/g,' ').trim();
const unwrap = s => oneLine(s).replace(/^<speak>/,'').replace(/<\/speak>$/,'');
const wrap = s => `<speak>${oneLine(s)}</speak>`;

router.post('/', (req,res)=>{
  const { intro, main, outro } = req.body || {};
  if(!intro || !main || !outro){
    return res.status(400).json({ error:'Provide { intro, main, outro } as SSML strings' });
  }
  const body = [ unwrap(intro), '<break time="700ms"/>', unwrap(main), '<break time="700ms"/>', unwrap(outro) ].join(' ');
  return res.json({ ssml: wrap(body) });
});

module.exports = router;
