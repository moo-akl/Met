const screens = [
  {
    title: "Home",
    image: "/__mockup/images/met-home-2026.png",
    description: "Current app · sample home",
  },
  {
    title: "Profile",
    image: "/__mockup/images/met-profile-2026.png",
    description: "Current app · sample profile",
  },
];

export function Current() {
  return (
    <main
      style={{
        width: 1080,
        height: 1000,
        boxSizing: "border-box",
        padding: "28px 42px",
        overflow: "hidden",
        color: "#19351f",
        background:
          "radial-gradient(ellipse at 50% -18%, rgba(61,204,68,.13), transparent 55%), #f6f7f0",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <header style={{ width: 760, margin: "0 auto 18px" }}>
        <div
          style={{
            color: "#398b42",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".22em",
            textTransform: "uppercase",
          }}
        >
          Met · source reference
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginTop: 5,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontFamily: "Georgia, serif",
              fontSize: 30,
              fontWeight: 400,
              letterSpacing: "-.04em",
            }}
          >
            Home + Profile
          </h1>
          <span style={{ color: "#718173", fontSize: 12 }}>
            Existing visual structure
          </span>
        </div>
      </header>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          gap: 34,
        }}
      >
        {screens.map((screen) => (
          <section
            key={screen.title}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 9,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                width: 344,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 650 }}>
                {screen.title}
              </h2>
              <span style={{ color: "#718173", fontSize: 10 }}>
                {screen.description}
              </span>
            </div>
            <div
              style={{
                width: 350,
                height: 760,
                padding: 5,
                boxSizing: "border-box",
                overflow: "hidden",
                border: "1px solid rgba(26,48,31,.24)",
                borderRadius: 34,
                background: "#142018",
                boxShadow: "0 20px 50px rgba(32,68,38,.16)",
              }}
            >
              <img
                src={screen.image}
                alt={`Current Met ${screen.title.toLowerCase()} screen`}
                style={{
                  display: "block",
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: 29,
                  background: "#f4f6ee",
                }}
              />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
