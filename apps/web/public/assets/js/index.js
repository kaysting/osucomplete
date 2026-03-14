let graphs = [];
const renderGraph = (canvasElement, opts) => {
    // 1. Apply Fixed Height (if provided)
    // This prevents blurriness and ensures the gradient spans the full area
    const height = opts.height || 200; // Default fallback
    if (opts.height) {
        canvasElement.height = height; // Internal resolution
        canvasElement.style.height = `${height}px`; // CSS display size
    }

    const ctx = canvasElement.getContext('2d');

    // 2. Define shared styles
    const tickStyle = {
        color: 'hsl(220, 20%, 65%)',
        font: {
            family: 'Torus',
            size: 11,
            weight: '600'
        },
        padding: 5,
        maxTicksLimit: 8
    };

    const gridStyle = {
        display: opts.showGrid || false,
        drawBorder: false,
        color: 'hsla(220, 20%, 70%, 0.1)'
    };

    const axisOptions = {
        display: true,
        grid: gridStyle,
        ticks: tickStyle,
        border: { display: false }
    };

    const datasets = [];
    for (const dataset of opts.datasets) {
        const hue = dataset.hue || 150;

        // 3. Dynamic Gradient Height
        // Spans from 0 (top) to the exact canvas height (bottom)
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, `hsla(${hue}, 90%, 60%, 20%)`);
        gradient.addColorStop(1, `hsla(${hue}, 90%, 60%, 0%)`); // Fades to transparent at bottom

        datasets.push({
            data: dataset.values,
            backgroundColor: gradient,
            borderColor: `hsl(${hue}, 90%, 60%)`,
            borderWidth: 2,
            pointRadius: 0,
            fill: true,
            tension: 0.3
        });
    }

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: opts.labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    displayColors: false,
                    cornerRadius: 8,
                    padding: 8,
                    titleMarginBottom: 2,
                    backgroundColor: 'hsl(220, 20%, 8%)',
                    titleFont: { size: 12, weight: 600, family: 'Torus' },
                    bodyFont: { size: 16, weight: 'normal', family: 'Torus' },
                    titleColor: `hsl(220, 20%, 65%)`,
                    bodyColor: `hsl(220, 20%, 90%)`,
                    callbacks: {
                        label: opts.tooltipCallbacks?.label || (context => context.parsed.y.toString()),
                        title: opts.tooltipCallbacks?.title || (context => `${context[0].label}`)
                    }
                }
            },
            scales: {
                x: opts.showX ? axisOptions : { display: false },
                y: opts.showY ? { ...axisOptions, beginAtZero: true } : { display: false }
            },
            layout: {
                padding: {
                    top: 5,
                    bottom: opts.showX ? 4 : 0,
                    left: opts.showY ? 4 : 0,
                    right: opts.showY ? 4 : 0
                }
            }
        }
    });
    graphs.push(chart);
    return chart;
};

document.addEventListener('htmx:load', () => {
    while (graphs.length) {
        const graph = graphs.shift();
        if (document.body.contains(graph.canvas)) continue;
        graph.destroy();
    }
});
