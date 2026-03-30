import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  Circle,
  MapPinned,
  Phone,
} from "lucide-react";

type Stop = {
  name: string;
  address: string;
  sta: string;
  warning?: string;
};

const STOPS: Stop[] = [
  {
    name: "Tampines Hub",
    address: "1 Tampines Walk, Singapore",
    sta: "12:30",
    warning: "Avoid ERP: CTP Northbound 7:30-9:00 AM",
  },
  {
    name: "Toa Payoh DC",
    address: "480 Lorong 6 Toa Payoh, Singapore",
    sta: "15:00",
  },
  {
    name: "Woodlands Hub",
    address: "111 Edgefield Plains, Singapore",
    sta: "17:45",
  },
];

function TimelineItem({
  stop,
  isLast,
  delayMs,
}: {
  stop: Stop;
  isLast: boolean;
  delayMs: number;
}) {
  return (
    <div
      className="relative flex animate-[slide-up_0.45s_ease-out_forwards] gap-3 pb-5 opacity-0 last:pb-0"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="relative z-10 mt-1 flex w-5 justify-center">
        <Circle className="h-3.5 w-3.5 fill-[#F06A33] text-[#F06A33]" />
      </div>
      {!isLast && (
        <div className="absolute left-[9px] top-6 h-[calc(100%-10px)] w-px border-l border-dashed border-[#D0D3DA]" />
      )}

      <div className="min-w-0 flex-1 rounded-xl bg-white">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[18px] font-semibold text-[#30323A]">{stop.name}</h3>
          <p className="text-[16px] font-semibold text-[#F06A33]">STA {stop.sta}</p>
        </div>
        <p className="mt-1 text-[13px] text-[#8B8F99]">{stop.address}</p>

        {stop.warning && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#FDEBED] px-3 py-2 text-[12px] text-[#C84B57]">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{stop.warning}</span>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className="flex h-8 items-center justify-center gap-1 rounded-md border border-[#D9DCE4] bg-white text-[13px] font-medium text-[#545866]">
            <Phone className="h-3.5 w-3.5" />
            Telephone
          </button>
          <button className="flex h-8 items-center justify-center gap-1 rounded-md border border-[#D9DCE4] bg-white text-[13px] font-medium text-[#545866]">
            <MapPinned className="h-3.5 w-3.5" />
            Navigation
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TaskDetailsFigma() {
  const trackRef = useRef<HTMLButtonElement>(null);
  const knobWidth = 44;
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);

  const getMaxDrag = () => {
    const trackWidth = trackRef.current?.clientWidth ?? 0;
    return Math.max(trackWidth - knobWidth - 4, 0);
  };

  const onDragStart = () => {
    if (isCheckedIn) return;
    setIsDragging(true);
  };

  const onDragMove = (clientX: number) => {
    if (!isDragging || isCheckedIn || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const next = clientX - rect.left - knobWidth / 2;
    setDragX(Math.min(Math.max(next, 2), getMaxDrag()));
  };

  const onDragEnd = () => {
    if (!isDragging || isCheckedIn) return;
    setIsDragging(false);
    const maxDrag = getMaxDrag();
    const threshold = maxDrag * 0.82;
    if (dragX >= threshold) {
      setDragX(maxDrag);
      setIsCheckedIn(true);
      return;
    }
    setDragX(0);
  };

  return (
    <div className="min-h-screen bg-[#EFEFF2] py-6">
      <div className="mx-auto w-full max-w-[390px] animate-[scale-in_0.35s_ease-out] rounded-[24px] bg-[#EFEFF2] shadow-[0_20px_50px_rgba(27,33,46,0.12)]">
        <header className="animate-[slide-up_0.35s_ease-out] rounded-t-[24px] bg-[#EE6730] px-4 pb-4 pt-3 text-white">
          <div className="mb-2 flex items-center justify-between text-[12px]">
            <span>9:41</span>
            <span>5G</span>
          </div>
          <div className="flex items-center justify-between">
            <button
              aria-label="Go back"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-[16px] font-semibold">Task Details</h1>
            <div className="w-8" />
          </div>
        </header>

        <main className="space-y-3 px-4 pb-4 pt-3">
          <section className="flex animate-[slide-up_0.45s_ease-out] items-center justify-between rounded-xl bg-white px-3 py-3">
            <p className="text-[14px] text-[#454A57]">
              Trip Number: <span className="font-semibold text-[#2D3240]">LH0203</span>
            </p>
            <span className="rounded-full bg-[#FFF4EC] px-2.5 py-1 text-[12px] font-medium text-[#EE6730]">
              Pending
            </span>
          </section>

          <section className="flex animate-[slide-up_0.5s_ease-out] items-center gap-2 rounded-xl bg-[#5B86F4] px-3 py-2.5 text-[12px] text-white">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p>There will be a heavy rainstorm in half an hour. Please plan accordingly.</p>
          </section>

          <section className="rounded-xl bg-white px-3 py-4">
            {STOPS.map((stop, idx) => (
              <TimelineItem
                key={stop.name}
                stop={stop}
                isLast={idx === STOPS.length - 1}
                delayMs={180 + idx * 120}
              />
            ))}
          </section>

          <button
            ref={trackRef}
            type="button"
            className="relative flex h-11 w-full items-center justify-center overflow-hidden rounded-xl bg-[#EE6730] text-[15px] font-semibold text-white"
            onMouseMove={(e) => onDragMove(e.clientX)}
            onMouseUp={onDragEnd}
            onMouseLeave={onDragEnd}
            onTouchMove={(e) => onDragMove(e.touches[0]?.clientX ?? 0)}
            onTouchEnd={onDragEnd}
          >
            <span className={`transition-opacity ${isDragging ? "opacity-75" : "opacity-100"}`}>
              {isCheckedIn ? "Checked in" : "Slide to check in"}
            </span>
            {!isCheckedIn && <ChevronRight className="ml-1 h-4 w-4" />}
            {isCheckedIn && <Check className="ml-1 h-4 w-4" />}

            <span
              role="presentation"
              className={`absolute left-0 top-0 h-full w-11 rounded-xl bg-white/30 backdrop-blur-[1px] ${
                isDragging ? "" : "transition-transform duration-200 ease-out"
              }`}
              style={{ transform: `translateX(${dragX}px)` }}
              onMouseDown={onDragStart}
              onTouchStart={onDragStart}
            />
          </button>
        </main>
      </div>
    </div>
  );
}
