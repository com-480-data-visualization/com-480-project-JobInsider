# Project of Data Visualization (COM-480)

| Student's name               | SCIPER |
| ---------------------------- | ------ |
| Cesar Ernesto Illanes Argote | 396219 |
| Yuanlong Li                  | 322588 |
| Tianzong Zhang               | 299091 |

[Milestone 1](#milestone-1) • [Milestone 2](#milestone-2) • [Milestone 3](#milestone-3)

## Milestone 1 (21st March, 5pm)

**10% of the final grade**

This is a preliminary milestone to let you set up goals for your final project and assess the feasibility of your ideas.
Please, fill the following sections about your project.

*(max. 2000 characters per section)*

### Dataset

We use [LinkedIn Job Postings (2023 - 2024)](https://www.kaggle.com/datasets/arshkon/linkedin-job-postings) that is publicly avaliable from Kaggle. Below is an exerpt from the dataset description:

> This dataset contains a nearly comprehehsive record of 124,000+ job postings listed in 2023 and 2024. Each individual posting contains dozens of valuable attributes for both postings and companies, including the title, job description, salary, location, application URL, and work-types (remote, contract, etc), in addition to separate files containing the benefits, skills, and industries associated with each posting. The majority of jobs are also linked to a company, which are all listed in another csv file containing attributes such as the company description, headquarters location, and number of employees, and follower count.
>
> With so many datapoints, the potential for exploration of this dataset is vast and includes exploring the highest compensated titles, companies, and locations; predicting salaries/benefits through NLP; and examining how industries and companies vary through their internship offerings and benefits.

### Problematic

How is the job market perspective for a job seeker currently? This is a question that especially vital to us young graduates. 

The motivation behind this data visualization project is to provide insights into the evolving job market, helping individuals and organizations understand which job titles, locations, and industries are experiencing the highest demand, as well as how compensation and benefits are distributed across different sectors. The analysis will also explore the prevalence of remote work and how companies differ in their internship offerings and employee benefits.



### Exploratory Data Analysis

> Pre-processing of the data set you chose
> - Show some basic statistics and get insights about the data

Please refer to [this notebook](milestone-1/explore.ipynb)

### Related work


> - What others have already done with the data?
> - Why is your approach original?
> - What source of inspiration do you take? Visualizations that you found on other websites or magazines (might be unrelated to your data).
> - In case you are using a dataset that you have already explored in another context (ML or ADA course, semester project...), you are required to share the report of that work to outline the differences with the submission for this class.

This dataset has been previously utilized in several analyses available on [Kaggle](https://www.kaggle.com/datasets/arshkon/linkedin-job-postings/code). However, the majority of these analyses are limited in scope, primarily consisting of basic visualizations within Jupyter notebooks, including [the one](https://www.kaggle.com/code/arshkon/getting-started-basic-analysis/notebook) developed by the dataset's original author. The Exploratory Data Analysis (EDA) presented in those works closely resembles the preliminary analysis conducted by our team.

The proposed approach seeks to provide a more comprehensive and visually engaging analysis by incorporating advanced visualizations and interactive elements. Additionally, we intend to integrate supplementary datasets to contextualize observed labor market trends over recent years and explore potential future developments. This approach aims to enhance interpretability and accessibility of the findings, particularly for recent graduates and early-career professionals.

It is important to note that none of the team members have previously worked with this dataset.


## Milestone 2 (18th April, 5pm)

**10% of the final grade**

Please refer to [this pdf](milestone-2/milestone_2.pdf) for the report.

## Milestone 3 (30th May, 5pm)

**80% of the final grade**

### Table of Contents
- [Overview](#overview)
- [Technical Setup](#technical-setup)
  - [Files and Structure](#files-and-structure)
  - [Dependencies](#dependencies)
  - [Installation](#installation)
  - [Technical Stack](#technical-stack)
- [Intended Usage](#intended-usage)

### Overview
Our visualization consists of a web application for users to browse the statistics of the current job market, including the number of job posting as well as its salary.

Please refer to `milestone-3/` for the process book and the screencast. The demo website can be accessed [here](https://com-480-data-visualization.github.io/com-480-project-JobInsider/).


### Technical Setup

#### Files and Structure
- `index.html`: The HTML file that serves as the portal of our demo.
- `styles.css`: The CSS file that contains styles for the HTML elements.
- `map.js`: The JavaScript file that handles the map logic.
- `data_processed/`: Directory for the processed data, including the US states shapefile, and the job market statistics. The processing step is implemented in `milestone-2/data_cleaning.ipynb`.

#### Installation
1. Clone the repository to your local machine.
2. Open with VS code and install VS Code Live Server extension.
3. Click "Go Live" in the bottom right corner of the VS code interface.

#### Technical Stack
Our demo uses html, CSS and javascript (specifically d3.js, leaflet.js) as frontend technical stack, and python (specifically numpy, pandas) as backend stack.

### Intended Usage
The user will be able to see the statistics of the current job market, including the number of job posting as well as its median salary for each states in the US. In addition, the user will be able to select a date range to see the statistics within the selected date range. 

The data is visualized three-fold:
- In the map, where a color scheme is used to show the level of the median salary for each state and selected time range;
- In the tooltip box inside the map, where the same statistics in the map are shown as a number;
- In the bottom chart box, where for a given state (clicked by the user) the time series of the statistics will be shown for every day within the date range.



## Late policy

- < 24h: 80% of the grade for the milestone
- < 48h: 70% of the grade for the milestone

