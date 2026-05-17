require('dotenv').config();

const SERPER_SEARCH_URL = 'https://google.serper.dev/search';

function getYouTubeVideoId(videoUrl) {
  try {
    const parsedUrl = new URL(videoUrl);
    const hostname = parsedUrl.hostname.replace(/^www\./, '');

    if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      if (parsedUrl.pathname === '/watch') {
        return parsedUrl.searchParams.get('v');
      }

      if (parsedUrl.pathname.startsWith('/shorts/')) {
        return parsedUrl.pathname.split('/')[2] || null;
      }
    }

    if (hostname === 'youtu.be') {
      return parsedUrl.pathname.replace('/', '') || null;
    }

    return null;
  } catch (err) {
    return null;
  }
}

function toEmbedUrl(videoUrl) {
  const videoId = getYouTubeVideoId(videoUrl);
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

function isYouTubeWatchUrl(url) {
  return typeof url === 'string' && url.includes('youtube.com/watch') && Boolean(getYouTubeVideoId(url));
}

async function findBestVideo(searchQuery, weekNumber) {
  if (!process.env.SERPER_API_KEY) {
    console.warn(`Serper Search skipped for week ${weekNumber}: SERPER_API_KEY is not configured.`);
    return null;
  }

  if (!searchQuery || typeof searchQuery !== 'string') {
    console.warn(`Serper Search skipped for week ${weekNumber}: missing search query.`);
    return null;
  }

  try {
    const response = await fetch(SERPER_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.SERPER_API_KEY,
      },
      body: JSON.stringify({
        q: `${searchQuery} site:youtube.com/watch`,
        num: 5,
      }),
    });

    if (!response.ok) {
      console.error(`Serper Search failed for week ${weekNumber}: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const results = Array.isArray(data?.organic) ? data.organic : [];
    const youtubeResult = results.find((result) => isYouTubeWatchUrl(result.link));

    if (!youtubeResult) {
      console.warn(`No YouTube video found for week ${weekNumber}: ${searchQuery}`);
      return null;
    }

    const embedUrl = toEmbedUrl(youtubeResult.link);

    if (!embedUrl) {
      console.warn(`Could not convert YouTube URL to embed URL for week ${weekNumber}: ${youtubeResult.link}`);
      return null;
    }

    return {
      url: youtubeResult.link,
      title: youtubeResult.title || `Week ${weekNumber} tutorial video`,
      embedUrl,
    };
  } catch (err) {
    console.error(`Serper Search error for week ${weekNumber}:`, err.message);
    return null;
  }
}

module.exports = {
  findBestVideo,
};
