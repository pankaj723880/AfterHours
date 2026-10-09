          <div className="max-w-7xl mx-auto px-4 md:px-8 pt-8 space-y-12">
            <ScrollableRow
              title="Trending songs"
              subtitle="The most played hits right now"
              items={trendingSongs}
              showAll={showAllTrending}
              setShowAll={setShowAllTrending}
              renderItem={(song) => (
                <div onClick={() => handlePlayTrending(song.query || song.title)} className="group cursor-pointer">
                  <div className="relative mb-3">
                    <img src={song.image} alt={song.title} className="w-full aspect-square rounded-md object-cover shadow-lg group-hover:shadow-amber-500/20 transition-all duration-300" onError={(e)=>{e.target.src='https://ui-avatars.com/api/?name='+encodeURIComponent(song.title)+'&background=random&size=300'}} />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                      <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition">
                        <Play fill="currentColor" className="w-5 h-5 text-neutral-950 translate-x-[2px]" />
                      </div>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-white truncate group-hover:text-amber-400 transition">{song.title}</h3>
                  <p className="text-xs text-neutral-400 truncate mt-1">{song.artist}</p>
                </div>
              )}
            />

            <ScrollableRow
              title="Popular artists"
              subtitle="Find your favorite singers"
              items={POPULAR_ARTISTS}
              showAll={showAllArtists}
              setShowAll={setShowAllArtists}
              renderItem={(artist) => (
                <div onClick={() => handleArtistClick(artist.name)} className="group cursor-pointer flex flex-col items-center">
                  <div className="relative mb-3 w-32 h-32 md:w-full md:aspect-square rounded-full overflow-hidden shadow-lg border-2 border-transparent group-hover:border-amber-500 transition-all duration-300">
                    <img src={artist.image} alt={artist.name} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" onError={(e)=>{e.target.src='https://ui-avatars.com/api/?name='+encodeURIComponent(artist.name)+'&background=random&size=300'}} />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <Icon name="search" className="w-8 h-8 text-white drop-shadow-md transform scale-90 group-hover:scale-100 transition" />
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-white truncate w-full text-center group-hover:text-amber-400 transition">{artist.name}</h3>
                  <p className="text-xs text-neutral-400 truncate mt-1 w-full text-center">{artist.role}</p>
                </div>
              )}
            />

            <ScrollableRow
              title="Popular albums and singles"
              subtitle="Latest releases"
              items={popularAlbums}
              showAll={showAllAlbums}
              setShowAll={setShowAllAlbums}
              renderItem={(album) => (
                <div onClick={() => handlePlayTrending(album.query || album.title)} className="group cursor-pointer">
                  <div className="relative mb-3">
                    <img src={album.image} alt={album.title} className="w-full aspect-square rounded-md object-cover shadow-lg group-hover:shadow-amber-500/20 transition-all duration-300" onError={(e)=>{e.target.src='https://ui-avatars.com/api/?name='+encodeURIComponent(album.title)+'&background=random&size=300'}} />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                      <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition">
                        <Play fill="currentColor" className="w-5 h-5 text-neutral-950 translate-x-[2px]" />
                      </div>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-white truncate group-hover:text-amber-400 transition">{album.title}</h3>
                  <p className="text-xs text-neutral-400 truncate mt-1">{album.artist}</p>
                </div>
              )}
            />

            <ScrollableRow
              title="Popular radio"
              subtitle="Live streams 24/7"
              items={popularRadio}
              showAll={showAllRadio}
              setShowAll={setShowAllRadio}
              renderItem={(radio) => (
                <div onClick={() => handlePlayTrending(radio.query || radio.title)} className="group cursor-pointer">
                  <div className="relative mb-3">
                    <img src={radio.image} alt={radio.title} className="w-full aspect-square rounded-md object-cover shadow-lg group-hover:shadow-amber-500/20 transition-all duration-300" onError={(e)=>{e.target.src='https://ui-avatars.com/api/?name='+encodeURIComponent(radio.title)+'&background=random&size=300'}} />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                      <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition">
                        <Play fill="currentColor" className="w-5 h-5 text-neutral-950 translate-x-[2px]" />
                      </div>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-white truncate group-hover:text-amber-400 transition">{radio.title}</h3>
                  <p className="text-xs text-neutral-400 truncate mt-1">{radio.artist}</p>
                </div>
              )}
            />
