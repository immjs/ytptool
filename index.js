require('dotenv').config();
(async () => {
  const getSubtitles = require('youtube-captions-scraper').getSubtitles;
  const TextToIPA = require('text-to-ipa');
  const fetch = require('node-fetch')
  const readline = require('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const ask = q => new Promise(r => {
    rl.resume();
    rl.question(q + ': ', a => {
      rl.pause();
      r(a)
    })
  })
  const cId = await ask("Channel ID")
  //const cId = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&forUsername=${encodeURIComponent(channel_name)}&key=${process.env.YTGAPIKEU}`)
  const response = await (await fetch(`https://www.googleapis.com/youtube/v3/search?order=date&part=snippet&channelId=${cId}&maxResults=25&key=${process.env.YTGAPIKEY}`)).json()
  let ids = response.items.map(v => v.id.videoId)
  const found = []
  const foundHelpful = []
  TextToIPA.loadDict();
  const lookupPhrase = p => p.split(' ').map(v => {
    v = v.replace(/\?|\.|\!|\,/g, '')
    let lookup = TextToIPA.lookup(v.toLowerCase())
    let e = lookup.split(' OR ')
    if (e.length != 1) return e
    return lookup
  })
  const findIfContains = (s1, s2) => {
    let all = []
    for (let i = 0; i < s1.length; i++) {
      for (let j = 0; j < i; j++) {
        if (s2.includes(s1.substring(i, j))) {
          all.push(s1.substring(i, j))
        }
      }
    }
    return all.filter(v => !v.match(/^\s+$/g)).filter(v => v.match(/[A-z]/g))
  }
  const meanStrLn = a => a.reduce((a, v) => +a + v.length, 0) / a.length
  const script = lookupPhrase(await ask("Script")).map(v => Array.isArray(v) ? v[0] : v).join(' ')
  console.log("here")
  for (let idx in ids) {
    const vId = ids[idx]
    console.log(`video ${+idx+1} of ${ids.length}`)
    try {
      let data = await getSubtitles({
        videoID: vId, // youtube video id
        lang: 'en' // default: `en`
      })
      for (let i in data) {
        let v = data[i]
        v.phonetics = lookupPhrase(v.text).map(v1 => Array.isArray(v1) ? v1[0] : v1).join(' ')
        let foundIdtcl = findIfContains(v.phonetics, script)
        if (foundIdtcl.length != 0) {
          found.push({
            v,
            vId,
            foundIdtcl
          })
        }
        // console.log(v.text, v.phonetics, i, data.length)
      }
    } catch (err) {
      if (err.message.includes('Could not find')) console.log(`Skipping ${vId}, no captions avail`)
      else console.error(`Skipping ${vId}, unknown error`, err)
    }
  }
  let total = "";
  let finalData = found.sort((a, b) => (meanStrLn(b.foundIdtcl)) - (meanStrLn(a.foundIdtcl))).filter((v, i) => {
    let backup = total;
    if (total.split('') == script.split('').filter((v, i, a) => a.indexOf(v) == i).sort()) return false
    total += v.foundIdtcl.reduce((a, v) => a + v, '')
    total = total.split('').filter((v, i, a) => a.indexOf(v) == i).sort().join('')
    if (backup != total) foundHelpful.push(i)
    return true
  }).filter((_, i) => foundHelpful.indexOf(i) != -1)
  console.log(finalData)
  finalData = finalData.map(v=>({
    ...v,
    foundBiggest: v.v.phonetics.match(new RegExp(script.split('').map(v=>v+'?').join(''), 'g')).map(v=>v.trim()).filter(v=>!['', 'ˈ'].includes(v)&&!v.match(/^ +$/))
  }))
  console.log(...(finalData.map(v => [`https://youtube.com/watch?v=${v.vId}&t=${Math.floor(v.v.start)}`, v.foundIdtcl.reduce((a, v) => a.length < v.length ? v : a), v.v.phonetics, v.v.text, v.foundBiggest])))
})();