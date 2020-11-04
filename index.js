require('dotenv').config();

if (!process.env.YTGAPIKEY) {
  throw new Error(`Please add a .env file, put the following in:
YGTAPIKEY=[[Your Youtube GAPI key]]`);
}
const usage = require('command-line-usage')([
  {
    header: 'YTPtool',
    content: 'Helps making parodies/YTPs by partially removing the sample searching part',
  },
  {
    header: 'Options',
    optionList: [
      {
        name: 'nvideos',
        description: 'Specifies the number of videos to fetch from',
        alias: 'n',
        type: Number,
        typeLabel: '{underline numberOfVideos}',
      },
      {
        name: 'channelid',
        description: 'Specifies the channel ID to fetch video IDs from',
        alias: 'i',
        type: String,
        typeLabel: '{underline channelId}',
      },
      {
        name: 'script',
        description: 'Specifies the script to refer from',
        alias: 's',
        type: String,
        typeLabel: '{underline script}',
      },
      {
        name: 'susage',
        description: 'Specifies wether you are using this for scripted usage, will only output urls',
        alias: 'u',
        type: Boolean,
      },
      {
        name: 'help',
        alias: 'h',
        description: 'Prints this usage guide.',
      },
    ],
  },
]);
const args = require('command-line-args')([
  { name: 'nvideos', alias: 'n', type: Number },
  { name: 'channelid', alias: 'i', type: String },
  { name: 'script', alias: 's', type: String },
  { name: 'susage', alias: 'u', type: Boolean },
  { name: 'help', alias: 'h', type: Boolean },
]);
// eslint-disable-next-line no-unused-vars
const colors = require('colors');
const { getSubtitles } = require('youtube-captions-scraper');
const TextToIPA = require('@informath/text-to-ipa');
const fetch = require('node-fetch');
const readline = require('readline');

if (args.help) {
  console.log(usage);
  process.exit();
}
(async () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const ask = (q) => new Promise((r) => {
    rl.resume();
    rl.question(`${q} `, (a) => {
      rl.pause();
      r(a);
    });
  });
  const lookupPhrase = (p) => p.split(' ').map((v) => {
    const lookup = TextToIPA.lookup(v.replace(/\?|\.|!|,/g, '').toLowerCase());
    const array = lookup.split(' OR ');
    if (array.length !== 1) return array;
    return lookup;
  });
  const findIfContains = (s1, s2) => {
    const all = [];
    // Unperformant, no need to fix, youtube automated subtitles are short
    for (let i = 0; i < s1.length; i += 1) {
      for (let j = 0; j < i; j += 1) {
        if (s2.includes(s1.substring(i, j))) {
          all.push(s1.substring(i, j));
        }
      }
    }
    return all.filter((v) => !v.match(/^\s+$/g)).filter((v) => v.match(/[A-z]/g));
  };
  const meanStrLn = (arr) => arr.reduce((a, v) => +a + v.length, 0) / arr.length;
  const cId = await ask('Channel ID:'.bgWhite.black);
  const response = await (
    await fetch(`https://www.googleapis.com/youtube/v3/search?order=date&part=snippet&channelId=${cId}&maxResults=25&key=${process.env.YTGAPIKEY}`)
  ).json();
  const script = lookupPhrase(
    await ask('Script:'.bgWhite.black),
  ).map((v) => (Array.isArray(v) ? v[0] : v)).join(' ');
  const ids = response.items.map((v) => v.id.videoId);
  const found = [];
  const foundHelpful = [];
  TextToIPA.loadDict();
  console.log(`Expect ${script.underline.red}`);
  let current = '';
  for (let idx = 0; idx < ids.length; idx += 1) {
    const vId = ids[idx];
    try {
      // eslint-disable-next-line no-await-in-loop
      const data = await getSubtitles({
        videoID: vId,
        lang: 'en',
      });
      for (let i = 0; i < data.length; i += 1) {
        const v = data[i];
        v.phonetics = lookupPhrase(
          v.text,
        ).map((v1) => (Array.isArray(v1) ? v1[0] : v1)).join(' ');
        const foundIdtcl = findIfContains(v.phonetics, script);
        if (foundIdtcl.length !== 0) {
          found.push({
            v,
            vId,
            foundIdtcl,
          });
        }
      }
      current += 'o';
    } catch (err) {
      if (err.message.includes('Could not find')) current += 'x';
      else current += 'X';
    }
    process.stdout.write(`\r[${current.padEnd(25, ' ')}]`);
  }
  console.log();
  let total = '';
  let finalData = found
    .sort((a, b) => (meanStrLn(b.foundIdtcl)) - (meanStrLn(a.foundIdtcl)))
    .filter((v, i) => {
      const backup = total;
      if (total === script.split('').filter((vS, iS, aS) => aS.indexOf(vS) === iS).sort().join('')) return false;
      total += v.foundIdtcl.reduce((aI, vI) => aI + vI, '');
      total = total.split('').filter((vT, iT, aT) => aT.indexOf(vT) === iT).sort().join('');
      if (backup !== total) foundHelpful.push(i);
      return true;
    });
  if (total !== script.split('').filter((v, i, a) => a.indexOf(v) === i).sort().join('')) {
    return console.log(`Not enough sample, leaving. Try with more videos with --.
Expected: ${script.split('').filter((v, i, a) => a.indexOf(v) === i).sort().join('').bgGreen}
Found:    ${total.bgRed}`);
  }
  finalData = finalData.filter((_, i) => foundHelpful.indexOf(i) !== -1).map((v) => ({
    ...v,
    foundBiggest: v.v.phonetics
      .match(
        new RegExp(`(${script.split('').map((s) => `${s}?`).join('')})`, 'g'),
      )
      .map((s) => s.trim())
      .filter((s) => !['', 'ˈ'].includes(s) && !s.match(/^ +$/)),
    formatted: v.v.phonetics
      .replace(
        new RegExp(`(${script.split('').map((s) => `${s}?`).join('')})`, 'g'),
        '***$1***',
      )
      .split('***')
      .map((vS, iS) => ((iS % 2 === 0 || ['', 'ˈ'].includes(vS) || vS.match(/^ +$/g)) ? vS : `${vS.green}`))
      .join(''),
  }));
  return finalData.map((v) => ({
    url: `https://youtube.com/watch?v=${v.vId}&t=${Math.floor(v.v.start)}`,
    text: v.v.text,
    formatted: v.formatted,
  })).forEach((v) => {
    console.log('----');
    console.log(v.url.blue);
    console.log(v.text.grey);
    console.log(v.formatted);
  });
})();
