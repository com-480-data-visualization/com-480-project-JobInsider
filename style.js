const map = L.map('map').setView([37.8, -96], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let geo_layer;
let lab_layer;
let cur_data = {};
let cur_industry = 'all';
let cur_metric = 'median';

const CHART_LEFT_MARGIN = 120;

const default_style = {
    fillColor:  'rgba(255, 255, 255, 0)',
    weight:      1.5,
    opacity:     1,
    color:      'black',
    fillOpacity: 0.9,
};

function create_tooltip() {
    return d3.select('body')
        .append('div')
        .attr('class', 'chart-tooltip')
        .style('opacity', 0);
}

function show_tooltip(tooltip, event, html_content) {
    tooltip.transition()
        .duration(200)
        .style('opacity', .9);
    tooltip.html(html_content)
        .style('left', (event.pageX + 10) + 'px')
        .style('top',  (event.pageY - 28) + 'px');
}

function hide_tooltip(tooltip) {
    tooltip.transition()
        .duration(500)
        .style('opacity', 0);
}

function add_hover_effect(element, hover_color, normal_color = '#4a90e2') {
    element.on('mouseover', function() {
        d3.select(this)
            .transition()
            .duration(200)
            .style('fill', hover_color);
    })
    .on('mouseout', function() {
        d3.select(this)
            .transition()
            .duration(200)
            .style('fill', normal_color);
    });
}

function clear_container(container_id) {
    document.getElementById(container_id).innerHTML = '';
}

function show_no_data_message(container_id, message = 'No data available for the selected range') {
    document.getElementById(container_id).innerHTML = `
        <div style="height: 100%; display: flex; align-items: center; justify-content: center; color: #666;">
            <p>${message}</p>
        </div>`;
}

function format_currency(value) {
    return `$${Math.round(value).toLocaleString()}`;
}

function get_chart_dimensions(container_id, margin) {
    const container = document.getElementById(container_id);

    return {
        width:  container.clientWidth  - margin.left - margin.right,
        height: container.clientHeight - margin.top  - margin.bottom,
        container
    };
}

function create_svg(container_id, width, height, margin) {
    return d3.select(`#${container_id}`)
        .append('svg')
        .attr('width',  width  + margin.left + margin.right)
        .attr('height', height + margin.top  + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
}

document.getElementById('industry-select').addEventListener('change', function(e) {
    cur_industry = e.target.value;
    update_map();
});

document.getElementById('metric-select').addEventListener('change', function(e) {
    cur_metric = e.target.value;
    update_map();
});

function add_state_labels(geo) {
    if (lab_layer)
        map.removeLayer(lab_layer);

    lab_layer = L.layerGroup().addTo(map);

    geo.features.forEach(ft => {
        const center = L.geoJSON(ft).getBounds().getCenter();
        const label  = L.divIcon({
            className: 'state-label',
            html:      `<div>${ft.properties.NAME}</div>`,
            iconSize:   null
        });

        L.marker(center, {
            icon:        label,
            interactive: false
        }).addTo(lab_layer);
    });
}

function handle_state_click(feature, layer) {
    update_left_panel(feature.properties.NAME);

    const colors = get_salary_colors();

    geo_layer.eachLayer(l => {
        const name = l.feature.properties.NAME;
        const style = colors[name] || default_style;
        l.setStyle(style);
    });

    const style = colors[feature.properties.NAME] || default_style;

    layer.setStyle({
        ...style,
        weight:      3,
        color:      '#1976D2',
        fillOpacity: style.fillOpacity !== undefined ?
            style.fillOpacity : default_style.fillOpacity
    });
}

function handle_state_hover(e) {
    const target = e.target;

    if (target.originalFillColor === undefined) {
        target.originalFillColor   = target.options.fillColor;
        target.originalFillOpacity = target.options.fillOpacity;
    }

    if (target.options.fillColor &&
        target.options.fillColor !== default_style.fillColor) {
        const darker = d3.color(target.options.fillColor).darker(0.5).toString();

        target.setStyle({
            fillColor:   darker,
            fillOpacity: target.originalFillOpacity
        });

    } else
        target.setStyle({
            fillColor:  'rgb(80, 80, 80)',
            fillOpacity: 0.2
        });
}

function handle_state_mouseout(e) {
    const target = e.target;

    target.setStyle({
        fillColor:   target.originalFillColor,
        fillOpacity: target.originalFillOpacity
    });

    delete target.originalFillColor;
    delete target.originalFillOpacity;
}

function load_country_data() {
    const geo = 'data_processed/us-states.json';
    const agg = 'data_processed/agg.json';

    if (geo_layer)
        map.removeLayer(geo_layer);

    fetch(geo)
        .then(resp => resp.json())
        .then(data => {
            geo_layer = L.geoJSON(data, {
                style: default_style,

                onEachFeature: function(feature, layer) {
                    layer.on({
                        click: () => handle_state_click(feature, layer),
                        mouseover: handle_state_hover,
                        mouseout:  handle_state_mouseout
                    });
                }
            }).addTo(map);

            add_state_labels(data);

            return fetch(agg);
        })
        .then(response => response.json())
        .then(data => {
            cur_data = data;
            update_map();
        })
        .catch(error => console.error('Error loading data:', error));
}

function get_salary_colors() {
    const salary = {};
    const colors = {};

    for (const [state, industries] of Object.entries(cur_data)) {
        if (cur_industry === 'all') {
            const all = [];

            Object.values(industries).forEach(industry => {
                if (industry.salary_stats && industry.salary_stats.median_salary)
                    all.push(industry.salary_stats.median_salary);
            });

            if (all.length > 0) {
                all.sort((a, b) => a - b);

                const mid = Math.floor(all.length / 2);

                salary[state] = all.length % 2 === 0 ?
                    (all[mid - 1] + all[mid]) / 2 :
                     all[mid];
            }

        } else if (industries[cur_industry] && industries[cur_industry].salary_stats)
            salary[state] = industries[cur_industry].salary_stats.median_salary;
    }

    const color = d3.scaleQuantize()
        .domain(d3.extent(Object.values(salary).filter(s => s > 0)))
        .range(["#ffffe5", "#fff6c0", "#fee799", "#fece66", "#fdac3b",
                "#f58720", "#e1640e", "#bf4804", "#933304", "#662506"]);

    for (const [state, sal] of Object.entries(salary))
        if (sal)
            colors[state] = {
                fillColor:   color(sal),
                weight:      1.5,
                opacity:     1,
                color:      'black',
                fillOpacity: 0.9
            };

    return colors;
}

function get_metric_value(industry_data) {
    if (cur_metric === 'jobs')
        return industry_data.total_job_posts;

    const metric_map = {
        'median': 'median_salary',
        'avg': 'avg_salary',
        'min': 'min_salary',
        'max': 'max_salary'
    };

    return industry_data.salary_stats[metric_map[cur_metric]];
}

function update_map() {
    if (!cur_data || !geo_layer)
        return;

    const value_by_state = {};

    for (const [state, industries] of Object.entries(cur_data)) {
        if (cur_industry === 'all') {
            if (cur_metric === 'jobs')
                value_by_state[state] = Object.values(industries)
                    .reduce((sum, industry) =>
                        sum + (industry.total_job_posts || 0), 0);
            else {
                const values = [];

                Object.values(industries).forEach(industry => {
                    if (industry.salary_stats) {
                        const value = get_metric_value(industry);

                        if (value)
                            values.push(value);
                    }
                });

                if (values.length > 0) {
                    values.sort((a, b) => a - b);

                    const mid = Math.floor(values.length / 2);

                    value_by_state[state] =
                        values.length % 2 === 0 ?
                            (values[mid - 1] + values[mid]) / 2 :
                             values[mid];
                }
            }

        } else if (industries[cur_industry])
            value_by_state[state] = get_metric_value(industries[cur_industry]);
    }

    const color = d3.scaleQuantize()
        .domain(d3.extent(Object.values(value_by_state).filter(v => v > 0)))
        .range(["#ffffe5", "#fff6c0", "#fee799", "#fece66", "#fdac3b",
                "#f58720", "#e1640e", "#bf4804", "#933304", "#662506"]);

    show_legend(color, cur_metric);

    geo_layer.setStyle(feature => {
        const state_name = feature.properties.NAME;
        const value = value_by_state[state_name];

        if (!value)
            return default_style;

        return {
            fillColor:   color(value),
            weight:      1.5,
            opacity:     1,
            color:      'black',
            fillOpacity: 0.9,
        };
    });
}

function show_legend(color, metric) {
    const legend = d3.select("#legend");

    legend.html("");

    const domain     =  color.domain();
    const step       = (domain[1] - domain[0]) / color.range().length;
    const data_range =  d3.range(domain[0], domain[1], step).reverse();

    const items = legend.selectAll(".legend-item")
        .data(data_range)
        .enter()
        .append("div")
        .attr("class", "legend-item");

    items.append("div")
        .attr("class", "legend-div")
        .style("background", d => color(d));

    items.append("span")
        .attr("class", "legend-span")
        .text(d => metric === 'jobs' ? d.toLocaleString() : format_currency(d));
}

// Chart creation functions
function add_bar_chart_elements(svg, data, x, y, value_key, name_key, value_formatter, tooltip) {
    const bars = svg.selectAll('.bar')
        .data(data)
        .enter()
        .append('g');

    const rects = bars.append('rect')
        .attr('class', 'bar')
        .attr('x', 0)
        .attr('y', d => y(d[name_key]))
        .attr('width', d => x(d[value_key]))
        .attr('height', y.bandwidth());

    add_hover_effect(rects, '#357abd');

    rects.on('mouseover', function(event, d) {
        show_tooltip(tooltip, event, `${d[name_key]}: ${value_formatter(d[value_key])}`);
    })
    .on('mouseout', function() {
        hide_tooltip(tooltip);
    });

    bars.append('text')
        .attr('class', 'company-name')
        .attr('x', -5)
        .attr('y', d => y(d[name_key]) + y.bandwidth() / 2)
        .attr('dy', '.35em')
        .attr('text-anchor', 'end')
        .text(d => {
            const name = d[name_key];

            return name.length > 10 ? name.substring(0, 8) + '...' : name;
        })
        .on('mouseover', function(event, d) {
            show_tooltip(tooltip, event, `${d[name_key]}: ${value_formatter(d[value_key])}`);
        })
        .on('mouseout', function() {
            hide_tooltip(tooltip);
        });

    bars.append('text')
        .attr('class', 'value-label')
        .attr('x', d => x(d[value_key]) + 5)
        .attr('y', d => y(d[name_key]) + y.bandwidth() / 2)
        .attr('dy', '.35em')
        .text(d => value_formatter(d[value_key]));
}

function create_salary_stats_chart(salary_stats, container_id) {
    const data = [
        { label: 'Min', value: salary_stats.min },
        { label: 'Avg', value: salary_stats.avg },
        { label: 'Med', value: salary_stats.median },
        { label: 'Max', value: salary_stats.max }
    ];

    clear_container(container_id);
    
    d3.select(`#${container_id}`)
        .append('strong')
        .text('Salary Statistics');

    if (!data || data.length === 0) {
        show_no_data_message(container_id);
        return;
    }

    const margin = {top: 10, right: 50, bottom: 10, left: CHART_LEFT_MARGIN};
    const height = data.length * 25;
    
    const container = document.getElementById(container_id);
    const width = container.clientWidth - margin.left - margin.right;

    const svg = create_svg(container_id, width, height, margin);

    const x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.value)])
        .range([0, width]);

    const y = d3.scaleBand()
        .domain(data.map(d => d.label))
        .range([0, height])
        .padding(0.1);

    const tooltip = create_tooltip();

    add_bar_chart_elements(svg, data, x, y,
                          'value', 'label',
                           val => format_currency(val), tooltip);
}

function create_bar_chart(data, container_id,
                          value_key, value_formatter, title) {
    clear_container(container_id);
    
    d3.select(`#${container_id}`)
        .append('strong')
        .text(title);

    if (!data || data.length === 0) {
        show_no_data_message(container_id);
        return;
    }

    const margin = {top: 10, right: 50, bottom: 10, left: CHART_LEFT_MARGIN};
    const height = data.length * 25;
    
    const container = document.getElementById(container_id);
    const width = container.clientWidth - margin.left - margin.right;

    const svg = create_svg(container_id, width, height, margin);

    const x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d[value_key])])
        .range([0, width]);

    const y = d3.scaleBand()
        .domain(data.map(d => d.company_name))
        .range([0, height])
        .padding(0.1);

    const tooltip = create_tooltip();

    add_bar_chart_elements(svg, data, x, y, value_key,
                          'company_name', value_formatter, tooltip);
}

function create_pie_chart(data, container_id, name_key, value_key,
                          slice_count = null) {
    clear_container(container_id);

    if (!data || data.length === 0) {
        show_no_data_message(container_id);
        return;
    }

    let pie_data = data;

    if (slice_count)
        pie_data = data.slice(0, slice_count);

    const margin = { top: 20, right: 120, bottom: 20, left: 20 };
    const { width, height } = get_chart_dimensions(container_id, margin);
    const radius = Math.min(width, height) / 2;

    const svg = create_svg(container_id,
                           width  + margin.left + margin.right,
                           height + margin.top  + margin.bottom,
                           { top: 0, right: 0, bottom: 0, left: 0 })
        .append('g')
        .attr('transform', `translate(${width/2 + margin.left},${height/2 + margin.top})`);

    const color   = d3.scaleOrdinal(d3.schemeCategory10);
    const tooltip = create_tooltip();

    const pie = d3.pie()
        .value(d => d[value_key])
        .sort(null);

    const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(radius);

    const legend = svg.selectAll('.legend')
        .data(pie_data)
        .enter()
        .append('g')
        .attr('class', 'legend')
        .attr('transform', (d, i) => `translate(${radius + 30},${-radius + i * 20})`);

    legend.append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .style('fill', (d, i) => color(i));

    const reduced = data.reduce((sum, item) => sum + item[value_key], 0);

    legend.append('text')
        .attr('x', 20)
        .attr('y', 10)
        .text(d => `${d[name_key]} (${d[value_key]} jobs, ${((d[value_key] / reduced) * 100).toFixed(1)}%)`)
        .style('font-size', '16px')
        .style('fill', 'black');

    const slices = svg.selectAll('path')
        .data(pie(pie_data))
        .enter()
        .append('path')
        .attr('class', 'pie-segment')
        .attr('d', arc)
        .attr('fill', (d, i) => color(i))
        .attr('stroke', 'white')
        .style('stroke-width', '2px');

    slices.on('mouseover', function(event, d) {
        const data_item = d.data;
        const total = data.reduce((sum, item) => sum + item[value_key], 0);
        const percentage = ((data_item[value_key] / total) * 100).toFixed(1);
        
        show_tooltip(tooltip, event, `
            <div style="font-weight: bold; margin-bottom: 5px; color: ${color(pie_data.indexOf(data_item))}">${data_item[name_key]}</div>
            <div style="margin-bottom: 3px">Number of Jobs: ${data_item[value_key].toLocaleString()}</div>
            <div>Market Share: ${percentage}%</div>
        `);
    })
    .on('mousemove', function(event) {
        tooltip
            .style('left', (event.pageX + 10) + 'px')
            .style('top',  (event.pageY - 28) + 'px');
    })
    .on('mouseout', function() {
        hide_tooltip(tooltip);
    });
}

function create_salary_bar_chart(data, container_id, title,
                                 name_key = 'industry') {
    clear_container(container_id);

    if (!data || data.length === 0) {
        show_no_data_message(container_id);
        return;
    }

    const margin = { top: 20, right: 20, bottom: 100, left: 120 };
    const { width, height } = get_chart_dimensions(container_id, margin);

    if (width <= 0 || height <= 0)
        return;

    const svg = create_svg(container_id, width, height, margin);

    const x = d3.scaleBand()
        .range([0, width])
        .padding(0.2);

    const y = d3.scaleLinear()
        .range([height, 0]);

    const value_key = name_key === 'industry' ? 'avgSalary' : 'avgSalary';
    
    x.domain(data.map(d => d[name_key]));
    y.domain([0, d3.max(data, d => d[value_key]) * 1.1]);

    svg.append('g')
        .attr('class', 'chart-axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end')
        .style('font-size', '18px')
        .style('fill', 'black')
        .attr('dx', '-0.8em')
        .attr('dy', '0.15em');

    svg.append('g')
        .attr('class', 'chart-axis')
        .call(d3.axisLeft(y)
            .ticks(5)
            .tickFormat(d => `$${d3.format(',.0f')(d)}`))
        .selectAll('text')
        .style('font-size', '18px')
        .style('fill', 'black');

    const tooltip = create_tooltip();

    const bars = svg.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d[name_key]))
        .attr('width', x.bandwidth())
        .attr('y', d => y(d[value_key]))
        .attr('height', d => height - y(d[value_key]));

    add_hover_effect(bars, '#357abd');

    bars.on('mouseover', function(event, d) {
        show_tooltip(tooltip, event, `
            <strong>${d[name_key]}</strong><br/>
            Average Salary: ${format_currency(d[value_key])}<br/>
            Number of Jobs: ${d.jobCount}
        `);
    })
    .on('mouseout', function() {
        hide_tooltip(tooltip);
    });

    svg.append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - (height / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('fill', 'black')
        .style('font-size', '18px')
        .text('Average Salary ($)');
}

function update_left_panel(state_name) {
    const panel = document.querySelector('#left-panel .panel-content');
    const state_industries = cur_data[state_name];

    let content      = `<h3>${state_name}</h3>`;
    let all_salaries = [];
    let total_jobs   = 0;

    let all_companies_highest_salary = [];
    let all_companies_most_posts     = [];

    if (state_industries) {
        if (cur_industry === 'all') {
            Object.values(state_industries).forEach(industry => {
                if (industry.salary_stats && industry.salary_stats.median_salary)
                    all_salaries.push(industry.salary_stats.median_salary);
                
                total_jobs += industry.total_job_posts || 0;

                if (industry.top_companies_by_avg_salary)
                    all_companies_highest_salary =
                        all_companies_highest_salary.concat(
                            industry.top_companies_by_avg_salary);
                
                if (industry.top_companies_by_posts)
                    all_companies_most_posts =
                        all_companies_most_posts.concat(
                            industry.top_companies_by_posts);
            });

            all_companies_highest_salary.sort((a, b) =>
                b.avg_salary - a.avg_salary);
            all_companies_highest_salary =
                all_companies_highest_salary.slice(0, 10);

            all_companies_most_posts.sort((a, b) =>
                b.post_count - a.post_count);
            all_companies_most_posts = [
                ...new Map(all_companies_most_posts.map(item =>
                    [item.company_name, item])).values()].slice(0, 10);

            if (all_salaries.length > 0) {
                content += `<div class="salary-stats">`;
                content += `<strong>All Industries</strong>`;
                content += `<span class="total-jobs">Total Jobs: ${total_jobs.toLocaleString()}</span></div>`;
                content += `<div class="salary-chart" id="salary-stats-chart"></div>`;
                content += `<div class="company-charts">`;
                content += `<div class="company-chart" id="salary-chart"></div>`;
                content += `<div class="company-chart" id="posts-chart"></div>`;
                content += `</div>`;
            }
        } else if (state_industries[cur_industry]) {
            const industry_data = state_industries[cur_industry];

            content += `<div class="salary-stats">`;
            content += `<strong>${cur_industry}</strong>`;
            content += `<span class="total-jobs">Total Jobs: ${industry_data.total_job_posts.toLocaleString()}</span></div>`;
            content += `<div class="salary-chart" id="salary-stats-chart"></div>`;
            content += `<div class="company-charts">`;
            content += `<div class="company-chart" id="salary-chart"></div>`;
            content += `<div class="company-chart" id="posts-chart"></div>`;
            content += `</div>`;
        } else
            content += '<div class="no-data">No data for selected industry</div>';
    } else
        content += '<div class="no-data">No data available</div>';

    panel.innerHTML = content;

    if (state_industries) {
        const current_data = cur_industry === 'all' ? {
            top_companies_by_avg_salary: all_companies_highest_salary,
            top_companies_by_posts:      all_companies_most_posts
        } : state_industries[cur_industry];

        if (cur_industry === 'all' && all_salaries.length > 0) {
            const middle = Math.floor(all_salaries.length / 2);
            const salary_stats = {
                min:    Math.min(...all_salaries),
                max:    Math.max(...all_salaries),
                avg:    all_salaries.reduce((a, b) =>
                            a + b) / all_salaries.length,
                median: all_salaries.length % 2 === 0 ?
                           (all_salaries[middle - 1] + all_salaries[middle]) / 2 :
                            all_salaries[middle]
            };

            create_salary_stats_chart(salary_stats, 'salary-stats-chart');

        } else if (current_data && current_data.salary_stats) {
            const salary_stats = {
                min:    current_data.salary_stats.min_salary,
                max:    current_data.salary_stats.max_salary,
                avg:    current_data.salary_stats.avg_salary,
                median: current_data.salary_stats.median_salary
            };

            create_salary_stats_chart(salary_stats, 'salary-stats-chart');
        }

        if (current_data && current_data.top_companies_by_avg_salary)
            create_bar_chart(
                current_data.top_companies_by_avg_salary,
                'salary-chart',
                'avg_salary',
                val => format_currency(val),
                'Top Companies by Average Salary');

        if (current_data && current_data.top_companies_by_posts)
            create_bar_chart(
                current_data.top_companies_by_posts,
                'posts-chart',
                'post_count',
                val => val.toLocaleString(),
                'Top Companies by Job Posts');
    }
}

const market_start_date = document.getElementById('market-start-date');
const market_end_date   = document.getElementById('market-end-date');
const start_range       = document.getElementById('start-range');
const end_range         = document.getElementById('end-range');
const progress          = document.querySelector('.slider-progress');

function date_to_percent(date, min_date, max_date) {
    return ((date - min_date) / (max_date - min_date)) * 100;
}

function percent_to_date(percent, min_date, max_date) {
    const total_range = max_date - min_date;
    const time_offset = (percent / 100) * total_range;

    return new Date(min_date.getTime() + time_offset);
}

function format_date(date) {
    return date.toISOString().split('T')[0];
}

function update_slider() {
    const thumb_width  = 16;
    const thumb_offset = (thumb_width / 2) / start_range.offsetWidth * 100;

    const left  = parseFloat(start_range.value);
    const right = parseFloat(end_range.value);

    progress.style.left  = (left  + thumb_offset) + '%';
    progress.style.width = (right - left - (thumb_offset * 2)) + '%';
}

function initialize_slider() {
    const min_date   = new Date('2024-01-01');
    const max_date   = new Date('2024-12-31');
    const start_date = new Date(market_start_date.value);
    const end_date   = new Date(market_end_date.value);

    start_range.value = date_to_percent(start_date, min_date, max_date);
    end_range.value   = date_to_percent(end_date, min_date, max_date);

    update_slider();
}

function populate_states() {
    const states = [
        "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
        "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
        "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
        "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
        "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
        "New Hampshire", "New Jersey", "New Mexico", "New York",
        "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
        "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
        "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
        "West Virginia", "Wisconsin", "Wyoming"
    ];
    const select_element = document.getElementById('state-select-market');

    states.sort().forEach(state => {
        const option = document.createElement('option');
        option.value = state;
        option.textContent = state;
        select_element.appendChild(option);
    });
}

start_range.addEventListener('input', function() {
    if (parseInt(end_range.value) - parseInt(this.value) < 1)
        this.value = parseInt(end_range.value) - 1;
    
    const min_date = new Date('2024-01-01');
    const max_date = new Date('2024-12-31');
    const new_date = percent_to_date(this.value, min_date, max_date);

    market_start_date.value = format_date(new_date);

    update_slider();
    update_market_analysis(new Date(market_start_date.value),
                           new Date(market_end_date.value));
});

end_range.addEventListener('input', function() {
    if (parseInt(this.value) - parseInt(start_range.value) < 1)
        this.value = parseInt(start_range.value) + 1;
    
    const min_date = new Date('2024-01-01');
    const max_date = new Date('2024-12-31');
    const new_date = percent_to_date(this.value, min_date, max_date);

    market_end_date.value = format_date(new_date);

    update_slider();
    update_market_analysis(new Date(market_start_date.value),
                           new Date(market_end_date.value));
});

market_start_date.addEventListener('change', function() {
    const min_date   = new Date('2024-01-01');
    const max_date   = new Date('2024-12-31');
    const start_date = new Date(this.value);

    start_range.value = date_to_percent(start_date, min_date, max_date);
    update_slider();

    const end_date = new Date(market_end_date.value);

    if (end_date < start_date) {
        market_end_date.value = this.value;
        end_range.value = start_range.value;
        update_slider();
    }

    update_market_analysis(start_date, new Date(market_end_date.value));
});

market_end_date.addEventListener('change', function() {
    const min_date = new Date('2024-01-01');
    const max_date = new Date('2024-12-31');
    const end_date = new Date(this.value);

    end_range.value = date_to_percent(end_date, min_date, max_date);
    update_slider();

    const start_date = new Date(market_start_date.value);

    if (start_date > end_date) {
        market_start_date.value = this.value;
        start_range.value = end_range.value;
        update_slider();
    }

    update_market_analysis(new Date(market_start_date.value), end_date);
});

const market_state_select = document.getElementById('state-select-market');
market_state_select.addEventListener('change', function() {
    const start_date = new Date(market_start_date.value);
    const end_date   = new Date(market_end_date.value);

    update_market_analysis(start_date, end_date);
});

window.addEventListener('resize', function() {
    const start_date = new Date(market_start_date.value);
    const end_date   = new Date(market_end_date.value);

    update_market_analysis(start_date, end_date);
});

function update_market_analysis(start_date, end_date) {
    const selected_state = document.getElementById('state-select-market').value;
    fetch('data_processed/all.json')
        .then(response => {
            if (!response.ok)
                throw new Error(`HTTP error! status: ${response.status}`);

            return response.json();
        })
        .then(data => {
            const filtered_data = data.filter(d => {
                const job_date = new Date(d.date_posted);
                const matches_state =
                    selected_state === 'all' || d.state === selected_state;

                return job_date >= start_date &&
                       job_date <= end_date && matches_state;
            });

            const industry_count = {};
            const company_count  = {};
            const industry_data  = {};
            const company_data   = {};

            filtered_data.forEach(d => {
                industry_count[d.industry] =
                    (industry_count[d.industry] || 0) + 1;
                company_count [d.company ] =
                    (company_count [d.company] || 0) + 1;

                if (!industry_data[d.industry])
                    industry_data[d.industry] = { total: 0, count: 0 };
                if (!company_data[d.company ])
                    company_data [d.company ] = { total: 0, count: 0 };
                
                industry_data[d.industry].total += parseFloat(d.salary);
                industry_data[d.industry].count += 1;
                company_data [d.company ].total += parseFloat(d.salary);
                company_data [d.company ].count += 1;
            });

            const industry_averages = Object.entries(industry_data)
                .map(([industry, data]) => ({
                    industry,
                    avgSalary: data.total / data.count,
                    jobCount: data.count
                }))
                .sort((a, b) => b.avgSalary - a.avgSalary)
                .slice(0, 10);

            const company_averages = Object.entries(company_data)
                .filter(([company, data]) => data.count >= 2)
                .map(([company, data]) => ({
                    company,
                    avgSalary: data.total / data.count,
                    jobCount: data.count
                }))
                .sort((a, b) => b.avgSalary - a.avgSalary)
                .slice(0, 10);

            update_industry_pie_chart(filtered_data);
            update_company_pie_chart(filtered_data);
            update_industry_salary_chart(industry_averages);
            update_company_salary_chart(company_averages);
        })
        .catch(error => {
            const error_message =
`
<div style="height: 100%; display: flex; align-items: center; justify-content: center; color: #666;">
    <div>
        <p style="text-align: center; margin-bottom: 10px;">Error loading data</p>
        <p style="text-align: center; font-size: 0.9em;">${error.message}</p>
    </div>
</div>
`;
            ['industry-pie-chart',
             'company-pie-chart',
             'industry-bar-chart',
             'company-bar-chart'].forEach(id => {
                document.getElementById(id).innerHTML = error_message;
            });
        });
}

function update_industry_pie_chart(data) {
    const industry_count = {};

    data.forEach(d => {
        industry_count[d.industry] = (industry_count[d.industry] || 0) + 1;
    });

    const pie_data = Object.entries(industry_count)
        .map(([industry, count]) => ({
            industry,
            count,
            percentage: (count / data.length) * 100
        }))
        .sort((a, b) => b.count - a.count);

    create_pie_chart(pie_data,
                    'industry-pie-chart',
                    'industry',
                    'count');
}

function update_company_pie_chart(data) {
    const company_count = {};

    data.forEach(d => {
        company_count[d.company] = (company_count[d.company] || 0) + 1;
    });

    let pie_data = Object.entries(company_count)
        .map(([company, count]) => ({
            company,
            count,
            percentage: (count / data.length) * 100
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    const total_others = data.length -
                            pie_data.reduce((sum, item) => sum + item.count, 0);

    if (total_others > 0)
        pie_data.push({
            company: 'Others',
            count: total_others,
            percentage: (total_others / data.length) * 100
        });

    create_pie_chart(pie_data,
                    'company-pie-chart',
                    'company',
                    'count');
}

function update_industry_salary_chart(industry_averages) {
    create_salary_bar_chart(industry_averages,
                           'industry-bar-chart',
                           'Top Industries by Average Salary',
                           'industry');
}

function update_company_salary_chart(company_averages) {
    create_salary_bar_chart(company_averages,
                           'company-bar-chart',
                           'Top Companies by Average Salary',
                           'company');
}

document.addEventListener('DOMContentLoaded', function() {
    initialize_slider();
    populate_states();

    const start_date = new Date(market_start_date.value);
    const end_date   = new Date(market_end_date.value);

    update_market_analysis(start_date, end_date);
});

load_country_data();
