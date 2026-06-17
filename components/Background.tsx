"use client";

export function Background() {
  return (
    <>
      <div className="field" aria-hidden />
      <div
        className="drift"
        aria-hidden
        style={{ top: "-10%", left: "10%" }}
      />
      <div
        className="drift"
        aria-hidden
        style={{
          bottom: "-20%",
          right: "0%",
          animationDelay: "-13s",
          opacity: 0.7,
        }}
      />
      <div className="grain" aria-hidden />
    </>
  );
}
