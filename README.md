# ytptool
Removes the searching part in the process of making a parody/YTP
## How it works
Uses the YT API to look for the last 25 videos of a channel, then combines subtitles with provided scripts to find matching phonetics.
Then, gives the urls with timestamps of the matched samples.
## How to use it
First, you need to add a .env file with the following contents
```
YTGAPIKEY=[Youtube API Key]
```
You can get your own API key in the [Google Cloud Console](https://console.google.com)

Then, all you need to do is to run it with
```
node .
```
then fulfill the channel ID and the script (One sentence at a time is advised)