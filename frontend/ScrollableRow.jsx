import { ChevronLeft, ChevronRight, Play } from 'lucide-react';

const ScrollableRow = ({ title, subtitle, items, renderItem, showAll, setShowAll }) => {
  const scrollRef = React.useRef(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  React.useEffect(() => { checkScroll(); }, [items, showAll]);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -400 : 400;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="mb-12">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-1 text-white tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-neutral-400">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4">
          {!showAll && (
            <div className="hidden md:flex gap-2">
              <button onClick={() => scroll('left')} disabled={!canScrollLeft} className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 transition text-white"><ChevronLeft size={20} /></button>
              <button onClick={() => scroll('right')} disabled={!canScrollRight} className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 transition text-white"><ChevronRight size={20} /></button>
            </div>
          )}
          <button onClick={() => setShowAll(!showAll)} className="text-xs font-bold text-neutral-400 hover:text-white uppercase tracking-wider transition">
            {showAll ? 'Show Less' : 'View All'}
          </button>
        </div>
      </div>
      <div 
        ref={scrollRef}
        onScroll={checkScroll}
        className={showAll 
          ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6" 
          : "flex gap-6 overflow-x-auto pb-4 hide-scrollbar scroll-smooth"}
      >
        {items.map((item, i) => (
          <div key={i} className={showAll ? 'w-full' : 'w-40 shrink-0'}>
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
};
