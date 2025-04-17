const map = L.map('map').setView([37.8, -96], 4);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let stateData = {},
    geojsonLayer;

Promise.all([
    d3.json('us-states.json'), // Your state polygons
    d3.json('data_processed/state_time_series.json') // Your daily data
]).then(([geojson, stateTimeSeries]) => {
    stateData = stateTimeSeries;

    // TODO: Add a slider to control the date range, you just wrap this with a function and a slider with onchange
    const latestDate = '2024-04-12';
    const salaryByState = {};
    for (const [state, data] of Object.entries(stateTimeSeries)) {
        const entry = data.find(d => d.date === latestDate);
        if (entry) salaryByState[state] = entry.median_salary;
    }

    // Color scale
    const color = d3.scaleQuantize()
        .domain(d3.extent(Object.values(salaryByState)))
        .range(d3.schemeBlues[9]);

    // Style function
    function style(feature) {
        const stateName = feature.properties.NAME;
        const salary = salaryByState[stateName];
        return {
            fillColor: salary ? color(salary) : '#ccc',
            weight: 1,
            opacity: 1,
            color: 'white',
            fillOpacity: 0.8
        };
    }

    function onEachFeature(feature, layer) {
        layer.on('click', () => showChart(feature.properties.NAME));
        layer.bindTooltip(feature.properties.NAME, { sticky: true });
    }

    geojsonLayer = L.geoJson(geojson, {
        style,
        onEachFeature
    }).addTo(map);
});

function showChart(stateName) {
    const rawData = stateData[stateName] || [];

    // Filter by date range
    const data = rawData
        .map(d => ({...d, date: new Date(d.date) }))
        .filter(d => d.date >= new Date("2024-04-05") && d.date <= new Date("2024-04-20"));

    if (data.length === 0) return;

    // Clear existing chart
    d3.select("#chart").html("");

    const margin = { top: 30, right: 50, bottom: 30, left: 60 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scaleTime()
        .domain(d3.extent(data, d => d.date))
        .range([0, width]);

    const ySalary = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.median_salary > 0 ? d.median_salary : 0)])
        .nice()
        .range([height, 0]);

    const yJobs = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.job_count)])
        .nice()
        .range([height, 0]);

    // Axes
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(6));

    svg.append("g")
        .call(d3.axisLeft(yJobs));

    svg.append("g")
        .attr("transform", `translate(${width},0)`)
        .call(d3.axisRight(ySalary));

    // Bar chart for job_count
    const barWidth = width / data.length - 2;

    svg.selectAll(".bar")
        .data(data)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.date) - barWidth / 2)
        .attr("y", d => yJobs(d.job_count))
        .attr("width", barWidth)
        .attr("height", d => height - yJobs(d.job_count))
        .attr("fill", "#FFA726")
        .attr("opacity", 0.6);

    // Line chart for median_salary (filter out -1)
    const salaryData = data.filter(d => d.median_salary !== -1);

    const line = d3.line()
        .x(d => x(d.date))
        .y(d => ySalary(d.median_salary));

    svg.append("path")
        .datum(salaryData)
        .attr("fill", "none")
        .attr("stroke", "#1976D2")
        .attr("stroke-width", 2)
        .attr("d", line);

    // Chart title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("fill", "#333")
        .text(`Job Stats for ${stateName} (Apr 5-20, 2024)`);
}