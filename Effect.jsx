  React.useEffect(() => {
    const loadDynamicContent = async () => {
      try {
        const trendingRes = await fetchFromBackend("latest trending hindi hit songs");
        if(trendingRes && trendingRes.items) {
           setTrendingSongs(trendingRes.items.map(i => ({
             title: i.snippet.title,
             artist: i.snippet.channelTitle,
             image: i.snippet.thumbnails?.high?.url || i.snippet.thumbnails?.medium?.url || "",
             query: i.snippet.title + " " + i.snippet.channelTitle
           })));
        }

        const albumRes = await fetchFromBackend("latest popular hindi english pop albums");
        if(albumRes && albumRes.items) {
           setPopularAlbums(albumRes.items.map(i => ({
             title: i.snippet.title,
             artist: i.snippet.channelTitle,
             image: i.snippet.thumbnails?.high?.url || i.snippet.thumbnails?.medium?.url || "",
             query: i.snippet.title
           })));
        }

        const radioRes = await fetchFromBackend("popular radio station live stream");
        if(radioRes && radioRes.items) {
           setPopularRadio(radioRes.items.map(i => ({
             title: i.snippet.title,
             artist: i.snippet.channelTitle,
             image: i.snippet.thumbnails?.high?.url || i.snippet.thumbnails?.medium?.url || "",
             query: i.snippet.title
           })));
        }
      } catch (err) {}
    };
    loadDynamicContent();
  }, []);
