const map = L.map('map').setView([37.8, -96], 4);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let stateData = {},
    geojsonLayer,
    startDate = "2024-04-01",
    endDate = "2024-04-30";

// Function to convert string date to Date object
function parseDate(dateStr) {
    return new Date(dateStr);
}

// Function to format Date as YYYY-MM-DD
function formatDate(date) {
    const d = new Date(date);
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    return `${d.getFullYear()}-${month}-${day}`;
}

Promise.all([
    d3.json('us-states.json'), // Your state polygons
    d3.json('data_processed/state_time_series.json') // Your daily data
]).then(([geojson, stateTimeSeries]) => {
    stateData = stateTimeSeries;

    // Find the min and max dates from the data
    let allDates = [];
    Object.values(stateTimeSeries).forEach(stateData => {
        stateData.forEach(entry => {
            if (entry.date && !allDates.includes(entry.date)) {
                allDates.push(entry.date);
            }
        });
    });

    allDates.sort();
    if (allDates.length > 0) {
        startDate = allDates[0];
        endDate = allDates[allDates.length - 1];
    }

    showSlider(allDates);

    updateMap();
});

function showSlider(allDates) {
    const slider = d3.select("#slider")

    const inputs = slider.append("div")
        .attr("class", "slider-inputs")

    inputs.append("input")
        .attr("id",    "start-date")
        .attr("type",  "date")
        .attr("value",  startDate)
        .attr("class", "slider-input")
        .on("change", function() {
            startDate = this.value;
            updateMap();
        });

    inputs.append("input")
        .attr("id",    "end-date")
        .attr("type",  "date")
        .attr("value",  endDate)
        .attr("class", "slider-input")
        .on("change", function() {
            endDate = this.value;
            updateMap();
        });

    const w = slider.node().clientWidth;
    const h = 55;

    const svg = slider.append("svg")
        .attr("width",  w)
        .attr("height", h)
        .style("margin-top", "20px");

    const time = d3.scaleTime()
        .domain([new Date(allDates[0]), new Date(allDates[allDates.length - 1])])
        .range([0, w])
        .clamp(true);

    const axis = d3.axisBottom(time)
        .tickFormat(d3.timeFormat("%b %d"))
        .ticks(4);

    svg.append("g")
        .attr("class", "slider-axis")
        .attr("transform", `translate(0, ${h - 25})`)
        .call(axis);

    const brush = d3.brushX()
        .extent([[0, 0], [w, h - 25]])
        .on("brush", brushed);

    brush.move(svg.append("g")
                  .attr("class", "brush")
                  .call(brush),
               [0, w]);

    function brushed(event) {
        if (!event.sourceEvent)
            return;
        if (!event.selection)
            return;

        startDate = formatDate(time.invert(event.selection[0]));
        endDate   = formatDate(time.invert(event.selection[1]));

        d3.select("#start-date").property("value", startDate);
        d3.select("#end-date"  ).property("value", endDate);

        updateMap();
    }
}

function updateMap() {
    const salaryByState = {};

    for (const [state, data] of Object.entries(stateData)) {
        const filtered = data.filter(d =>
            d.date >= startDate && d.date <= endDate
        );

        if (filtered.length === 0)
            continue;

        const salaries = filtered.map(d => d.median_salary);

        if (salaries.length === 0)
            continue;

        salaries.sort((a, b) => a - b);

        const mid = Math.floor(salaries.length / 2);

        salaryByState[state] = (salaries.length % 2 === 0) ?
            ((salaries[mid - 1] + salaries[mid]) / 2) :
              salaries[mid];
    }

    const color = d3.scaleQuantize()
        .domain(d3.extent(Object.values(salaryByState).filter(s => s > 0)))
        .range(d3.schemeBlues[9]);

    if (geojsonLayer) {
    geojsonLayer.setStyle(feature => {
        const stateName = feature.properties.NAME;
        const salary = salaryByState[stateName];
        return {
            fillColor: salary ? color(salary) : '#ccc',
            weight: 1,
            opacity: 1,
            color: 'white',
            fillOpacity: 0.8
        };
    });
    }

    showLegend(color);

    const selectedState = d3.select("#chart").attr("data-state");

    if (selectedState)
        showChart(selectedState);
}

function showLegend(color) {
    const legend = d3.select("#legend");

    legend.html("");

    const domain = color.domain();
    const step = (domain[1] - domain[0]) / color.range().length;

    const items = legend.selectAll(".legend-item")
        .data(d3.range(domain[0], domain[1], step))
        .enter()
        .append("div")
        .attr("class", "legend-item")

    items.append("div")
        .attr("class", "legend-div")
        .style("background", d => color(d))

    items.append("span")
        .attr("class", "legend-span")
        .text(d => `$${Math.round(d).toLocaleString()}`);
}

function showChart(stateName) {
    const rawData = stateData[stateName] || [];

    // Filter by date range
    const data = rawData
        .map(d => ({...d, date: new Date(d.date) }))
        .filter(d => {
            const dateStr = formatDate(d.date);
            return dateStr >= startDate && dateStr <= endDate;
        })
        .sort((a, b) => a.date - b.date);

    if (data.length === 0)
        return;

    const chart = d3.select("#chart");

    // Remember the selected state
    chart.attr("data-state", stateName);

    // Clear existing chart
    chart.html("");

    const margin = { top: 30, right: 50, bottom: 30, left: 60 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = chart.append("svg")
        .attr("class", "chart-svg")
        .append("g");

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
}

function onEachFeature(feature, layer) {
    layer.on('click', () => showChart(feature.properties.NAME));
    layer.bindTooltip(feature.properties.NAME, { sticky: true });
}

// Create the geojson layer
d3.json('us-states.json').then(geojson => {
    geojsonLayer = L.geoJson(geojson, {
        style: {
            fillColor: '#ccc',
            weight: 1,
            opacity: 1,
            color: 'white',
            fillOpacity: 0.8
        },
        onEachFeature
    }).addTo(map);
});
