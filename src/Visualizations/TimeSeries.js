/**
 * Time series graph that plots the weekly scrobbles in a year.
 *
 * The data is received as a prop from the state of UserPage, it calculates the
 * number of scrobbles on each week, and plots week vs. scrobbles in a time
 * series graph.
 *
 * @file    This file defines the TimeSeries Component.
 * @author  davidomarf
 * @since   v0.2.0
 */

import React from "react";
import styles from "./Heatmap.module.scss";
import * as d3 from "d3";

const lineFunction = d3
  .line()
  .x(d => d3.select("#" + d.key).attr("cx"))
  .y(d => d3.select("#" + d.key).attr("cy"))
  .curve(d3.curveMonotoneX);

/* -------------------------- Component Definition -------------------------- */

/**
 * TimeSeries that plots the weekly scrobbles in a year.
 */
class TimeSeries extends React.Component {
  constructor(props) {
    super(props);

    // List containing {id:count} elements, where id is the ID generated using
    // getIDFromDate(), and count is the number of scrobbles in that date
    this.frequencyList = {};

    // Maximum number of scrobbles in a single day
    this.mostScrobblesInAWeek = 0;

    // The last date for the period to be displayed in the Heatmap
    this.endDate = { date: new Date() };
    this.endDate.uts = Math.ceil(this.endDate.date.getTime() / 1000);

    // Same day as endDate, but one year ago
    this.startDate = {
      date: new Date(
        new Date().setFullYear(this.endDate.date.getFullYear() - 1)
      )
    };
    this.startDate.utc = Math.floor(this.startDate.date.getTime() / 1000);
  }

  /**
   * Update the Heatmap to indicate the number of scrobbles in each day.
   *
   * Go through an "array-ized" version of frequencyList, and use the {id} to
   * select the SVG items, and the {value} to calculate the fill color.
   */
  updateHeatmapValues() {
    // Convert the dictionary into an array of {key, value} objects
    // @see https://github.com/d3/d3-collection#entries
    let freqArray = d3.entries(this.frequencyList);
    this.numberOfColorTags = 4;

    // Update using the maximum value in freqArray
    this.mostScrobblesInAWeek = d3.max(freqArray, d => d.value);

    for (let i = 0; i < freqArray.length; i++) {
      // The number sent to myColor is an integer between 0 and
      // this.numberOfColorTags. It is calculated by multiplying the ratio of
      // dayValue / maxValue by the number of available color tags.
      let color = myColor(
        Math.ceil(
          this.numberOfColorTags *
            (freqArray[i].value / this.mostScrobblesInAWeek)
        )
      );
      d3.select("#" + freqArray[i].key)
        .attr("cy", -(freqArray[i].value / this.mostScrobblesInAWeek) * 100)
        .style("fill", color)
        .attr("scrobbles", freqArray[i].value);
      d3.select("#ts-curve").attr("d", lineFunction(freqArray));
    }
  }

  drawHeatmapCells(svg) {
    // Create an array of dates for the year
    let dates = getDateArray(this.startDate.date, this.endDate.date);
    let style = styles["day"];
    svg
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 530)
      .attr("height", 1)
      .attr("fill", "#C0C4D4")
      ;

    svg
      .append("path")
      .attr("id", "ts-curve")
      .attr("d", lineFunction(d3.entries(this.frequencyList)))
      .attr("stroke", "#4E5467")
      .attr("stroke-width", .5)
      .attr("fill", "none");

    for (let i = 0; i < dates.length; i++) {
      let id = getIDFromDate(dates[i]);
      this.frequencyList[id] = 0;
      if (dates[i].getDate() <= 7) {
        svg
          .append("text")
          .attr("x", i * 10)
          .attr("y", 15 + 4)
          .text(months[dates[i].getMonth()])
          .attr("class", styles["meta-text"] + " " + styles["month-flag"]);
      }

      svg
        .append("circle")
        .attr("cx", i * 10)
        .attr("cy", 0)
        .attr("r", 1)
        .attr("class", style)
        .attr("id", id)
        // The attributes 'date' and 'scrobbles' are used to get the content
        // of the tooltip when hovering on a cell
        .attr("date", formatDate(dates[i]))
        .attr("scrobbles", 0)
        .on("mouseover", mouseover)
        .on("mousemove", mousemove)
        .on("mouseleave", mouseleave);
    }
  }

  /**
   * React function to run when the component updates
   *
   * It's expected that the component will be updated every time UserPage
   * fetches one more page of the scrobbles list.
   */
  componentDidUpdate() {
    // Assign the props value to a variable to avoid writing a lot
    let lastList = this.props.user.scrobbles;

    // If the list is empty, don't proceed
    if (lastList.length === 0) return;

    // Since this function runs every time it updates, and the only reason for
    // it to update is because UserPage added an item to the scrobbles list,
    // we can safely just work with the last item on that list (which) is a list
    lastList = lastList[lastList.length - 1];

    // This ensures that there are items on lastList that fit inside the period
    // that the Heatmap is displaying.
    if (
      (lastList.start >= this.startDate.utc &&
        lastList.start <= this.endDate.uts) ||
      (lastList.end <= this.endDate.uts && lastList.end >= this.startDate.utc)
    ) {
      // Convert the list of scrobble objects into a list of strings using the
      // date to determine an ID
      let idList = lastList.list
        .map(e =>
          getIDFromDate(
            new Date(
              1000 * Math.ceil(Number(e.date.uts) / 604800) * 604800 - 259200000
            )
          )
        )
        .filter(e => this.frequencyList[e] !== undefined);

      // This counts the number of times that a given id appears in the
      // current list of ids
      for (let i = 0; i < idList.length; i++) {
        let id = idList[i];
        // If this.frequencyList.id is defined, increment its value
        if (this.frequencyList[id] !== undefined) {
          this.frequencyList[id]++;
        }
      }

      // Update the values considering the new added scrobbles
      this.updateHeatmapValues();
    }
  }

  /**
   * React function to run when the component has been mounted
   *
   * This runs only once, and uses that fact to initialize the canvas, and append
   * the items that won't be redrawn.
   */
  componentDidMount() {
    // This creates the svg for the graph
    const svg = d3
      .select(`#d3-section-${this.props.title}`)
      .append("svg")
      // This makes the svg element responsive
      // @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/preserveAspectRatio
      // @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox
      .attr("preserveAspectRatio", "xMinYMin meet")
      .attr("viewBox", "-20 -250 560 270");

    // // Draw the Heatmap structure: Legend, texts, and cells
    // this.drawLegend(svg);
    // this.drawWeekDays(svg);
    this.drawHeatmapCells(svg);

    // Initialize the tooltip. Draw it after all other items so it stays at top
    tooltip = svg.append("rect");
    tooltip_text = svg.append("text");
  }

  render() {
    return (
      <>
        <div
          id={`d3-section-${this.props.title}`}
          className={styles["graph-container"]}
        />
      </>
    );
  }
}

/* ---------------------------- Helping Functions --------------------------- */

/**
 * Formats a Date in a readable String.
 *
 * The format is Month dd, YYYY.
 *
 * @param {Object} date  Date to be formatted
 * @returns {string}     Date to string in format Month dd, YYYY
 */
function formatDate(date) {
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

// Used to render the month's name without calling Date.toLocaleDateString()
const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

/**
 * Generate an array of dates containing every day between start and end.
 *
 * If start is a later date than end, it will generate the dates backwards.
 *
 * @param {Object} start  First value of the array
 * @param {Object} end    Last value of the array
 * @return {Object[]}     All the dates between start and end
 */
function getDateArray(start, end) {
  start.setDate(start.getDate() - start.getDay());
  end.setDate(end.getDate() + 6 - end.getDay());
  let step = 7;
  if (start > end) step = -7;
  let arr = [];
  let dt = new Date(start);

  while (dt <= end) {
    arr.push(new Date(dt));
    dt.setDate(dt.getDate() + step);
  }

  return arr;
}

/**
 * Creates an ID for a date using its Year, Month, Date.
 *
 * @param {Object} date Date to be used
 * @returns {string}    "hm-" + Date in format YYYY-MM-D
 */
function getIDFromDate(date) {
  return `ts-${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/**
 * Function to interpolate colors using a given d3 color palette.
 *
 * The domain is the range of the expected values to be received in the
 * interpolator. For this use case, domain[1] must match
 * Heatmap.numberofCategories.
 */
const myColor = d3
  .scaleLinear()
  .range(["#383C4A", "#e4fd3f"])
  .domain([0, 4]);

/* --------------------------- D3 Tooltip Elements -------------------------- */

// Tooltip and Tooltip text are global variables that are used to display the
// number of scrobbles and date of each day in the Heatmap.
let tooltip;
let tooltip_text;

// Rules to modify the tooltip the mouse is over
let mouseover = function(d) {
  tooltip.style("opacity", 0.9);
  tooltip_text.style("opacity", 1);
};

// Rules to modify the tooltip when the mouse moves within it
let mousemove = function(d) {
  let week = d3.select(this);
  tooltip_text
    .style("fill", "white")
    .text(`${week.attr("scrobbles")} scrobbles on ${week.attr("date")}`)
    .attr("class", styles["meta-text"])
    .attr(
      "x",
      d3.mouse(this)[0] +
        (d3.mouse(this)[0] > 410
          ? -(tooltip_text.node().getBBox().width + 15)
          : 15)
    )
    .attr("y", d3.mouse(this)[1]);
  tooltip
    .attr("width", tooltip_text.node().getBBox().width + 10)
    .attr("height", 15)
    .attr(
      "x",
      d3.mouse(this)[0] +
        (d3.mouse(this)[0] > 410
          ? -(tooltip_text.node().getBBox().width + 20)
          : 10)
    )
    .attr("y", d3.mouse(this)[1] - 10);
};

// Rules to modify the tooltip when the mouse leaves it
let mouseleave = function(d) {
  tooltip.style("opacity", 0);
  tooltip_text.text("");
};

/* ---------------------------- Export Component ---------------------------- */

export default TimeSeries;