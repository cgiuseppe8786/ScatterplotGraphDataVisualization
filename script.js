// ============================================================
// ENDPOINT DATI 
// - restituisce array di oggetti con anno, tempo, nome, doping, ...
// ============================================================
const DATA_URL =
    "https://raw.githubusercontent.com/freeCodeCamp/ProjectReferenceData/master/cyclist-data.json";

document.addEventListener("DOMContentLoaded", () => {
    // ==========================================================
    // 1) GESTIONE TEMA
    // - stesso approccio usato nel tuo bar chart GDP
    // - priorità: localStorage -> prefers-color-scheme -> default
    // - toggle via click + tastiera
    // ==========================================================
    const themeToggle = document.getElementById("theme-toggle");
    const body = document.body;

    // Se esiste un tema salvato, lo rispettiamo
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
        body.dataset.theme = savedTheme;
        themeToggle.textContent = savedTheme === "dark" ? "☀️" : "🌙";
    } else {
        // fallback su preferenza di sistema
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        body.dataset.theme = prefersDark ? "dark" : "light";
        themeToggle.textContent = prefersDark ? "☀️" : "🌙";
    }

    function toggleTheme() {
        const isDark = body.dataset.theme === "dark";
        body.dataset.theme = isDark ? "light" : "dark";
        localStorage.setItem("theme", body.dataset.theme);
        // feedback immediato sull’icona
        themeToggle.textContent = isDark ? "🌙" : "☀️";
    }

    // click mouse
    themeToggle.addEventListener("click", toggleTheme);
    // accessibilità: Invio/Spazio
    themeToggle.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") toggleTheme();
    });

    // ==========================================================
    // 2) COSTRUZIONE SCATTERPLOT CON D3
    // - setup svg responsivo
    // - margini e gruppo interno
    // - fetch dei dati e mapping su assi
    // ==========================================================
    const svg = d3.select("#chart");
    const width = 900;
    const height = 520;

    // viewBox per adattare il grafico al container
    svg
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    // margini per assi/label/legend
    const margin = { top: 40, right: 120, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // gruppo principale dove vive il grafico
    const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // tooltip assoluto (già presente in DOM)
    const tooltip = d3.select("#tooltip");

    // ----------------------------------------------------------
    // Helper: converte "MM:SS" in Date fittizia
    // - usiamo 1970-01-01 00:mm:ss
    // ----------------------------------------------------------
    function parseTimeToDate(timeStr) {
        const [m, s] = timeStr.split(":").map(Number);
        return new Date(1970, 0, 1, 0, m, s);
    }

    // ----------------------------------------------------------
    // Fetch dati dal repo 
    // ----------------------------------------------------------
    d3.json(DATA_URL).then((data) => {
        // data: [{ Time, Year, Name, Nationality, Doping, ... }, ...]
        // console.log(data);

        // --------------------------------------------------------
        // SCALE X (anni)
        // - leggero padding ai lati per non schiacciare i punti
        // --------------------------------------------------------
        const years = data.map((d) => d.Year);
        const xMin = d3.min(years) - 1;
        const xMax = d3.max(years) + 1;

        const xScale = d3
            .scaleLinear()
            .domain([xMin, xMax])
            .range([0, innerWidth]);

        // --------------------------------------------------------
        // SCALE Y (tempi)
        // - i tempi minori = prestazioni migliori
        // - per coerenza visiva, in alto i tempi migliori (valori minori)
        // --------------------------------------------------------
        const times = data.map((d) => parseTimeToDate(d.Time));
        const yMin = d3.min(times);
        const yMax = d3.max(times);

        const yScale = d3
            .scaleTime()
            .domain([yMin, yMax])
            .range([0, innerHeight]); // in basso i tempi più lenti

        // --------------------------------------------------------
        // ASSI (User Story #2 e #3)
        // --------------------------------------------------------
        const xAxis = d3.axisBottom(xScale).tickFormat(d3.format("d")); // anno intero
        const yAxis = d3.axisLeft(yScale).tickFormat(d3.timeFormat("%M:%S")); // "MM:SS"

        g.append("g")
            .attr("id", "x-axis")
            .attr("class", "axis")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(xAxis);

        g.append("g").attr("id", "y-axis").attr("class", "axis").call(yAxis);

        // --------------------------------------------------------
        // LEGEND (User Story #13)
        // - due stati: con e senza accuse di doping
        // - prendiamo i colori dai CSS custom properties
        // --------------------------------------------------------
        const legend = d3.select("#legend");
        legend.html(""); // pulizia

        const legendData = [
            {
                label: "No doping allegations",
                color: getComputedStyle(document.body)
                    .getPropertyValue("--dot-clean")
                    .trim(),
            },
            {
                label: "Riders with doping allegations",
                color: getComputedStyle(document.body)
                    .getPropertyValue("--dot-doping")
                    .trim(),
            },
        ];

        legendData.forEach((item) => {
            const el = legend.append("div").attr("class", "legend-item");
            el.append("span")
                .attr("class", "legend-swatch")
                .style("background", item.color);
            el.append("span").text(item.label);
        });

        // --------------------------------------------------------
        // PLOT PUNTI (User Story #4 -> #8)
        // - circle per ogni atleta
        // - data-xvalue e data-yvalue
        // - colore in base a presenza campo .Doping
        // - tooltip posizionato rispetto al container
        // --------------------------------------------------------
        g.selectAll(".dot")
            .data(data)
            .enter()
            .append("circle")
            .attr("class", "dot")
            .attr("r", 6)
            .attr("cx", (d) => xScale(d.Year))
            .attr("cy", (d) => yScale(parseTimeToDate(d.Time)))
            .attr("data-xvalue", (d) => d.Year)
            .attr("data-yvalue", (d) => parseTimeToDate(d.Time).toISOString())
            // colore per stato doping
            .attr("fill", (d) =>
                d.Doping ? "var(--dot-doping)" : "var(--dot-clean)"
            )
            // hover: mostra tooltip
            .on("mouseover", function (event, d) {
                const container = document.getElementById("container");
                const box = container.getBoundingClientRect();
                const ttNode = tooltip.node();
                const ttBox = ttNode.getBoundingClientRect();

                // contenuto tooltip (nome, nazione, anno, tempo, stato doping)
                tooltip
                    .style("opacity", 1)
                    .attr("data-year", d.Year) // User Story #15
                    .html(() => {
                        return `
              <strong>${d.Name}</strong>${d.Nationality ? " (" + d.Nationality + ")" : ""
                            }
              <br />
              Year: ${d.Year}, Time: ${d.Time}
              ${d.Doping
                                ? `<br /><span style="color:#fbbf24">⚠️ ${d.Doping}</span>`
                                : "<br /><span style='color:#94a3b8'>No doping allegations</span>"
                            }
            `;
                    });

                // posizionamento vicino al puntatore
                let left = event.clientX - box.left + 15;
                let top = event.clientY - box.top - ttBox.height - 12;

                // se non c'è spazio sopra, lo metto sotto
                if (top < 0) {
                    top = event.clientY - box.top + 12;
                }

                // limiti orizzontali
                const padding = 8;
                if (left < padding) left = padding;
                const newTTBox = ttNode.getBoundingClientRect();
                if (left + newTTBox.width > box.width - padding) {
                    left = box.width - newTTBox.width - padding;
                }

                tooltip.style("left", left + "px").style("top", top + "px");
            })
            // aggiorna posizione durante il mousemove
            .on("mousemove", function (event) {
                const container = document.getElementById("container");
                const box = container.getBoundingClientRect();
                const ttNode = tooltip.node();
                const ttBox = ttNode.getBoundingClientRect();

                let left = event.clientX - box.left + 15;
                let top = event.clientY - box.top - ttBox.height - 12;

                if (top < 0) {
                    top = event.clientY - box.top + 12;
                }

                const padding = 8;
                if (left < padding) left = padding;
                if (left + ttBox.width > box.width - padding) {
                    left = box.width - ttBox.width - padding;
                }

                tooltip.style("left", left + "px").style("top", top + "px");
            })
            // uscita: nasconde tooltip
            .on("mouseout", function () {
                tooltip.style("opacity", 0);
            });

        // --------------------------------------------------------
        // LABEL ASSE Y
        // --------------------------------------------------------
        g.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -innerHeight / 2)
            .attr("y", -margin.left + 15)
            .attr("text-anchor", "middle")
            .attr("class", "y-label")
            .attr("fill", getComputedStyle(document.body).getPropertyValue("--text"))
            .text("Time in minutes");
    });
});
