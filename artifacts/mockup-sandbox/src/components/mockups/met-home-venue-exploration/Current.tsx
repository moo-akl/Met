const screens = [
  {
    title: "Home",
    image: "/__mockup/images/met-current-home.jpg",
    description: "Live app · sample home",
  },
  {
    title: "Public venue",
    image: "/__mockup/images/met-current-venue.jpg",
    description: "Live app · Mira House Coffee",
  },
];

export function Current() {
  return (
    <main
      style={{
        width: 1120,
        height: 900,
        boxSizing: "border-box",
        padding: "22px 34px 26px",
        overflow: "hidden",
        color: "#f6f3eb",
        background:
          "radial-gradient(ellipse at 50% -25%, rgba(164,127,255,.20), transparent 58%), #101116",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <header style={{ margin: "0 auto 16px", width: 780 }}>
        <div
          style={{
            color: "#a98cff",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".24em",
            textTransform: "uppercase",
          }}
        >
          Met · current screens
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
              fontSize: 28,
              fontWeight: 400,
              letterSpacing: "-.04em",
            }}
          >
            Home → a place to meet
          </h1>
          <span style={{ color: "#8d8d98", fontSize: 12 }}>
            Source reference
          </span>
        </div>
      </header>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 24,
          height: 798,
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
                width: 359,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: "-.01em",
                }}
              >
                {screen.title}
              </h2>
              <span style={{ color: "#8d8d98", fontSize: 10 }}>
                {screen.description}
              </span>
            </div>
            <div
              style={{
                width: 367,
                height: 798,
                padding: 6,
                boxSizing: "border-box",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,.2)",
                borderRadius: 34,
                background: "#050607",
                boxShadow: "0 22px 65px rgba(0,0,0,.42)",
              }}
            >
              <img
                src={screen.image}
                alt={`${screen.title} screen as it currently appears in Met`}
                style={{
                  display: "block",
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  borderRadius: 28,
                  background: "#090a0d",
                }}
              />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
