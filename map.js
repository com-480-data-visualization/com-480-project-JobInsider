const map = L.map('map').setView([37.8, -96], 4);
L.maplibreGL({
    style: 'https://tiles.stadiamaps.com/styles/stamen_toner.json', // Style URL; see our documentation for more options
    attribution: 'Data: <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
}).addTo(map);

let stateData = {},
    geojsonLayer,
    startDate,
    endDate;

function formatDate(date) {
    const d = new Date(date);
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    return `${d.getFullYear()}-${month}-${day}`;
}

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
        .tickFormat(d3.timeFormat("%d.%m"))
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
        .range(["#ffffe5","#fff6c0","#fee799","#fece66","#fdac3b","#f58720","#e1640e","#bf4804","#933304","#662506"]);

    showLegend(color);

    const state = d3.select("#chart").attr("data-state");

    if (state)
        showChart(state);

    if (!geojsonLayer)
        return;

    geojsonLayer.setStyle(feature => {
        const stateName = feature.properties.NAME;
        // const salary = salaryByState[stateName];
        
        const raw = stateData[feature.properties.NAME] || [];

        const start = new Date(startDate);
        const end   = new Date(endDate);

        const data = raw
            .map(d => ({...d, date: new Date(d.date) }))
            .filter(d => {
                return d.date >= start && d.date <= end && d.median_salary !== -1;
            })
            .sort((a, b) => a.date - b.date);

        if (data.length === 0)
            return feature.properties.NAME;

        const index = Math.floor(data.length / 2);
        const median = (data.length % 2 === 0) ?
            ((data[index - 1].median_salary + data[index].median_salary) / 2) :
              data[index].median_salary;



        if (stateName === "Mississippi") {
            console.log(`State: ${stateName}, Salary: ${median}`);
        };
        return {
            fillColor: median ? color(median) : '#ccc',
            weight: 1,
            opacity: 1,
            color: 'white',
            fillOpacity: 0.8
        };
    });
}

function showLegend(color) {
    const legend = d3.select("#legend");
    console.log(color.domain(), color.range());

    legend.html("");

    const domain = color.domain();
    const step = (domain[1] - domain[0]) / color.range().length;

    // Generate reversed data range
    const dataRange = d3.range(domain[0], domain[1], step).reverse();

    const items = legend.selectAll(".legend-item")
        .data(dataRange)
        .enter()
        .append("div")
        .attr("class", "legend-item");

    items.append("div")
        .attr("class", "legend-div")
        .style("background", d => color(d));

    items.append("span")
        .attr("class", "legend-span")
        .text(d => `$${Math.round(d).toLocaleString()}`);
}


function showChart(stateName) {
    const rawData = stateData[stateName] || [];

    console.log(rawData);

    const start = new Date(startDate);
    const end   = new Date(endDate);

    const data = rawData
        .map(d => ({...d, date: new Date(d.date) }))
        .filter(d => {
            return d.date >= start && d.date <= end; // && d.median_salary !== -1;
        })
        .sort((a, b) => a.date - b.date);

    if (data.length === 0)
        return;

    const chart = d3.select("#chart");

    // Remember the selected state
    chart.attr("data-state", stateName);

    // Clear existing chart
    chart.html("");

    const margin = { top: 15, right: 35, bottom: 15, left: 35 };
    const width  = chart.node().clientWidth  * 0.68  - margin.left - margin.right;
    const height = chart.node().clientHeight * 0.97 - margin.top  - margin.bottom;

    const svg = chart.append("svg")
        .attr("class", "chart-svg")
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
        .call(d3.axisBottom(x));

    svg.append("g")
        .call(d3.axisLeft(yJobs));

    svg.append("g")
        .attr("transform", `translate(${width},0)`)
        .call(d3.axisRight(ySalary));

    // This is broken
    console.log(data);
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
        .y(d => ySalary(d.median_salary))
        .curve(d3.curveMonotoneX);

    svg.append("path")
        .datum(salaryData)
        .attr("fill", "none")
        .attr("stroke", "#1976D2")
        .attr("stroke-width", 2)
        .attr("d", line);

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 10)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("fill", "#333")
        .text(`Job Stats for ${stateName} (${startDate} to ${endDate})`);
}

function onEachFeature(feature, layer) {
    layer.on('click', () => showChart(feature.properties.NAME));
    layer.bindTooltip(function(layer) {
        if (!stateData)
            return feature.properties.NAME;

        const raw = stateData[feature.properties.NAME] || [];

        const start = new Date(startDate);
        const end   = new Date(endDate);

        const data = raw
            .map(d => ({...d, date: new Date(d.date) }))
            .filter(d => {
                return d.date >= start && d.date <= end && d.median_salary !== -1;
            })
            .sort((a, b) => a.date - b.date);

        if (data.length === 0)
            return `<h4>${feature.properties.NAME}</h4> <br> No data for the selected date range`;

        const index = Math.floor(data.length / 2);
        const median = (data.length % 2 === 0) ?
            ((data[index - 1].median_salary + data[index].median_salary) / 2) :
              data[index].median_salary;

        // Get the total job count
        const jobs = data.reduce((acc, d) => acc + d.job_count, 0);

        return `<h4>${feature.properties.NAME}</h4><br>
                Median Salary: $${median.toLocaleString()}<br>
                Total Job Count: ${jobs}`;

    }, { sticky: true });
}

d3.json('data_processed/state_time_series.json').then(stateTimeSeries => {

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

    console.log(`Start Date: ${startDate}, End Date: ${endDate}`);

    // Step 1: Normalize each state's time series
    Object.keys(stateTimeSeries).forEach(state => {
        const entries = stateTimeSeries[state];
        
        // Create a map from date to entry for quick lookup
        const dateMap = new Map(entries.map(d => [d.date, d]));

        // Fill missing dates with default values
        const filledEntries = allDates.map(date => {
            return dateMap.get(date) || { date: date, job_count: 0, median_salary: -1 };
        });

        // Replace the original state data with the filled one
        stateTimeSeries[state] = filledEntries;
    });
    

    stateData = stateTimeSeries;

    showSlider(allDates);

    updateMap();
});

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
