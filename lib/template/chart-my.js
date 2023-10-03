class Piechart {
    constructor(options) {
      this.options = options;
      this.canvas = options.canvas;
      this.ctx = this.canvas.getContext("2d");
      this.colors = options.colors;
      this.titleOptions = options.titleOptions;
      this.totalValue = Object.values(this.options.data).reduce((a, b) => a + b, 0);
      this.radius = Math.min(this.canvas.width / 2, this.canvas.height / 2) - options.padding;
    }
  
    drawSlices() {
      let colorIndex = 0;
      let startAngle = -Math.PI / 2;
  
      for (let category in this.options.data) {
        const value = this.options.data[category];
        const sliceAngle = (2 * Math.PI * value) / this.totalValue;
        
        this.drawPieSlice(
          this.canvas.width / 2,
          this.canvas.height / 2,
          this.radius,
          startAngle,
          startAngle + sliceAngle,
          this.colors[colorIndex % this.colors.length]
        );
  
        startAngle += sliceAngle;
        colorIndex++;
      }
    }
  
    drawPieSlice(centerX, centerY, radius, startAngle, endAngle, color) {
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.moveTo(centerX, centerY);
      this.ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      this.ctx.closePath();
      this.ctx.fill();
    }
  }
  
  // Приклад використання:
  
  const canvas = document.getElementById("testomatio_chart");
  const chart = new Piechart({
    canvas: canvas,
    colors: ["#FF5733", "#33FF57", "#5733FF"],
    data: {
      "Category A": 30,
      "Category B": 50,
      "Category C": 20,
    },
    titleOptions: {
      text: "Pie Chart",
      fontSize: 18,
      fontFamily: "Arial",
    },
    padding: 10,
  });
  
  chart.drawSlices();

// const styles = `
//   .chart-container {
//     margin: 0 auto;
//     width: 500px;
//   }
// `;

// const styleElement = document.createElement("style");
// styleElement.textContent = styles;
// document.head.insertAdjacentElement("beforeend", styleElement);

// class PieChart {
//     constructor(options) {
//       this.options = options;
//       this.canvas = options.canvas;
//       this.ctx = this.canvas.getContext("2d");
//       this.colors = options.colors;
//       this.titleOptions = options.titleOptions;
//       this.totalValue = Object.values(this.options.data).reduce((a, b) => a + b, 0);
//       this.radius = Math.min(this.canvas.width / 2, this.canvas.height / 2) - options.padding;
//     }
  
//     drawSlices() {
//       let colorIndex = 0;
//       let startAngle = -Math.PI / 2;
  
//       for (let category in this.options.data) {
//         const value = this.options.data[category];
//         const sliceAngle = (2 * Math.PI * value) / this.totalValue;
  
//         this.drawPieSlice(
//           this.canvas.width / 2,
//           this.canvas.height / 2,
//           this.radius,
//           startAngle,
//           startAngle + sliceAngle,
//           this.colors[colorIndex % this.colors.length],
//           this.options.strokeColor
//         );
  
//         startAngle += sliceAngle;
//         colorIndex++;
//       }
  
//       if (this.options.doughnutHoleSize) {
//         this.drawPieSlice(
//           this.canvas.width / 2,
//           this.canvas.height / 2,
//           this.options.doughnutHoleSize * this.radius,
//           0,
//           2 * Math.PI,
//           this.options.doughnutHoleColor,
//           this.options.doughnutHoleColor
//         );
  
//         this.drawPieSlice(
//           this.canvas.width / 2,
//           this.canvas.height / 2,
//           this.options.doughnutHoleSize * this.radius,
//           0,
//           2 * Math.PI,
//           "#FFF",
//           "#FFF"
//         );
//       }
//     }
  
//     drawPieSlice(centerX, centerY, radius, startAngle, endAngle, fillColor, strokeColor) {
//       this.ctx.save();
//       this.ctx.fillStyle = fillColor;
//       this.ctx.strokeStyle = strokeColor;
//       this.ctx.beginPath();
//       this.ctx.moveTo(centerX, centerY);
//       this.ctx.arc(centerX, centerY, radius, startAngle, endAngle);
//       this.ctx.closePath();
//       this.ctx.fill();
//       this.ctx.stroke();
//       this.ctx.restore();
//     }
  
//     drawLabels() {
//       let colorIndex = 0;
//       let startAngle = -Math.PI / 2;
  
//       for (let category in this.options.data) {
//         const value = this.options.data[category];
//         const sliceAngle = (2 * Math.PI * value) / this.totalValue;
//         let labelX =
//           this.canvas.width / 2 +
//           (this.radius / 2) * Math.cos(startAngle + sliceAngle / 2);
//         let labelY =
//           this.canvas.height / 2 +
//           (this.radius / 2) * Math.sin(startAngle + sliceAngle / 2);
  
//         if (this.options.doughnutHoleSize) {
//           const offset = (this.radius * this.options.doughnutHoleSize) / 2;
//           labelX =
//             this.canvas.width / 2 +
//             (offset + this.radius / 2) * Math.cos(startAngle + sliceAngle / 2);
//           labelY =
//             this.canvas.height / 2 +
//             (offset + this.radius / 2) * Math.sin(startAngle + sliceAngle / 2);
//         }
  
//         const labelText = Math.round((100 * value) / this.totalValue);
//         this.ctx.fillStyle = this.options.labelColor;
//         this.ctx.font = this.options.labelFont;
//         this.ctx.fillText(`${category}: ${labelText}%`, labelX, labelY);
//         startAngle += sliceAngle;
//       }
//     }
  
//     drawTitle() {
//       this.ctx.save();
//       this.ctx.textBaseline = "bottom";
//       this.ctx.textAlign = this.titleOptions.align;
//       this.ctx.fillStyle = this.titleOptions.fill;
//       this.ctx.font = `${this.titleOptions.font.weight} ${this.titleOptions.font.size} ${this.titleOptions.font.family}`;
  
//       let xPos = this.canvas.width / 2;
  
//       if (this.titleOptions.align == "left") {
//         xPos = 10;
//       }
//       if (this.titleOptions.align == "right") {
//         xPos = this.canvas.width - 10;
//       }
  
//       this.ctx.fillText(this.options.seriesName, xPos, this.canvas.height);
//       this.ctx.restore();
//     }
  
//     drawLegend() {
//       const legend = document.createElement("div");
//       legend.classList.add("legend");
  
//       for (let category of Object.keys(this.options.data)) {
//         const legendItem = document.createElement("div");
//         legendItem.classList.add("legend-item");
//         const legendColor = document.createElement("div");
//         legendColor.classList.add("legend-color");
//         legendColor.style.backgroundColor = this.colors[
//           this.options.colors.indexOf(this.options.colorMap[category])
//         ];
//         const legendLabel = document.createElement("div");
//         legendLabel.classList.add("legend-label");
//         legendLabel.textContent = category;
  
//         legendItem.appendChild(legendColor);
//         legendItem.appendChild(legendLabel);
//         legend.appendChild(legendItem);
//       }
  
//       document.body.appendChild(legend);
//     }
  
//     draw() {
//       this.drawSlices();
//       this.drawLabels();
//       this.drawTitle();
//       this.drawLegend();
//     }
//   }
  
//   const myCanvas = document.getElementById("testomatio_chart");
//   const myPiechart = new PieChart({
//     canvas: myCanvas,
//     seriesName: "Vinyl records",
//     padding: 40,
//     data: {
//       "Classical Music": 16,
//       "Alternative Rock": 12,
//       "Pop": 18,
//       "Jazz": 32,
//     },
//     colors: ["#80DEEA", "#FFE082", "#FFAB91", "#CE93D8"],
//     labelColor: "black",
//     labelFont: "32px Khand",
//     strokeColor: "black",
//     doughnutHoleSize: 0.4,
//     doughnutHoleColor: "#FFF",
//     titleOptions: {
//       align: "center",
//       fill: "black",
//       font: {
//         weight: "bold",
//         size: "18px",
//         family: "Lato",
//       },
//     },
//     colorMap: {
//       "Classical Music": "#80DEEA",
//       "Alternative Rock": "#FFE082",
//       "Pop": "#FFAB91",
//       "Jazz": "#CE93D8",
//     },
//   });
  
//   myPiechart.draw();
  