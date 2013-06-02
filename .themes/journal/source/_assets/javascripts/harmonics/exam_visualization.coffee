window.Exam =
  impl_mark: (x, y) ->
    x = (x - 50) / 26
    y = (y - 50) / 26
    a = 3 * Math.cos(Math.pow(x-1,2) + Math.pow(y,2))
    a += 2 * Math.cos(Math.pow(x-3,2) + Math.pow(y+4,2))
    a += 2 * Math.pow(Math.cos(x) + Math.cos(y+1), 3)
    a += 2 * Math.pow(Math.abs(Math.cos(0.4*x+3) + Math.cos(0.6*y-2)), 1/2)
    a -= 3 * Math.pow((Math.pow(x+2, 2) + Math.pow(y, 2)), 1/2)
    a -= 3 * Math.pow((Math.pow(x, 2) + Math.pow(y-1, 2)), 1/2)

    a

  impl_max: -Infinity
  impl_min: Infinity

  max: 100
  min: 1
  mark: (x, y) ->
    ((Exam.impl_mark(x, y) - Exam.impl_min) / (Exam.impl_max - Exam.impl_min)) * Exam.max

for x in [0..100]
  for y in [0..100]
    if (n = Exam.impl_mark(x,y)) > Exam.impl_max
      Exam.maxIndex = [x,y]
      Exam.impl_max = n
    if n < Exam.impl_min
      Exam.impl_min = n
      Exam.minIndex = [x,y]

class Harry.HeatmapVisualizer
  w: 100
  h: 100
  max: Exam.max
  min: Exam.min + 10
  ratio: 4
  id: "sleepMap"
  labels: true
  highlight: [-1, -1]
  
  constructor: (options = {})->
    _.extend(this, options)

    @x = pv.Scale.linear().domain(0, 10).range(0, @w*@ratio)
    @y = pv.Scale.linear().domain(0, 10).range(0, @h*@ratio)

    k = @max - @min
    @heat = pv.Scale.linear()
        .domain(Exam.min-1, Exam.min, @min, @min + k/6, @min + 2*k/6, @min + 3*k/6, @min + 4*k/6, @min + 5*k/6, @max)
        .range("#F00", "#000", "#000", "#0a0", "#6c0", "#ee0", "#eb4", "#eb9", "#fff")
        .by (x, y) =>
          if (Math.abs(x - @highlight[0]) + Math.abs(y - @highlight[1])) < 2
            Exam.min - 1
          else
            Exam.mark(x,y)

    @heatmap = new pv.Panel()
      .canvas(@id)
      .width(@w * @ratio)
      .height(@h * @ratio)
      .top(16)
      .strokeStyle("#aaa")
      .lineWidth(2)
      .antialias(false)

    @heatmap.margin(32) if @labels

    @heatmap.add(pv.Image)
      .imageWidth(@w)
      .imageHeight(@h)
      .image(@heat)

    if @labels
      @heatmap.add(pv.Rule)
          .data(@x.ticks())
          .strokeStyle("")
          .left(@x)
        .anchor("bottom").add(pv.Label)
          .text(@x.tickFormat)
          .font("8pt Droid Sans")

      @heatmap.add(pv.Rule)
          .data(@y.ticks())
          .strokeStyle("")
          .bottom(@y)
        .anchor("left").add(pv.Label)
          .text(@y.tickFormat)
          .font("8pt Droid Sans")

      @heatmap.add(pv.Label)
        .data(["Hours spent asleep"])
        .left(-15)
        .bottom(@h*@ratio/2)
        .textAlign("center")
        .textAngle(-Math.PI/2)
        .font("11pt Droid Sans")


      @heatmap.add(pv.Label)
        .data(["Hours spent studying"])
        .left(@w*@ratio/2)
        .bottom(-30)
        .textAlign("center")
        .font("11pt Droid Sans")

    @heatmap.render()
    $("##{@id} canvas").css
      width: @w * @ratio
      height: @h * @ratio
    
  render: () ->
    @heatmap.render()

class Harry.ExamHarmony extends Harry.Harmony
  quality: -> Exam.mark(@notes[0]*10, @notes[1]*10)

class Harry.HeatmapSearchVisualizer extends Harry.HarmonySearchVisualizer
  @defaults:
    width: 500
    height: 500
    thickness: 70
    edgeOffset: 10
    thicknessScale: 30
    targetQuality: 98
    id: false
    maxExtraRows: 0
    startOnInit: false
    creationVis:
      height: 500
      rowHeight: 28
      cellWidth: 30
      maxCols: 4
      firstColWidth: 60

  constructor: (options)->
    # Set up options
    @options = _.extend({}, HeatmapSearchVisualizer.defaults, options)
    super
    @game.css
      "padding-top": "10px"

    # Start the algo so the vis shows up, but stop it right after unless asked to start
    this.start() if @options.startOnInit
    true

  showSolution: (harmony, forceRender = false) ->
    @showing = harmony
    @heatmap.highlight = _(harmony.notes).map (x) -> x*10
    this.render()
  
  render: () ->
    super
    @heatmap.render()

  _initializeCreationVisualization: ->
    @heatmap = new Harry.HeatmapVisualizer
      id: @options.id + "_game"
      ratio: 2
      labels: false
    super

  _initializeSearch: ->
    # Set up search
    notes = (i/10 for i in [0..100])
    options =
      # Configure search for sudoku
      maxTries: 10000
      targetQuality: @options.targetQuality
      harmonyMemoryConsiderationRate: .7
      pitchAdjustmentRate: .1
      notesGlobal: true
      notes: notes
      harmonyMemorySize: 16
      instruments: 2
      # Pull out the user selected values
      timer: 300
      iterationMilestone: 3

    @options.maxRows = options.harmonyMemorySize
    fmtquality = (h) -> (Math.round(h.quality() * 100)/100).toFixed(2)

    @search = new Harry.HarmonySearch _.extend(options,
        harmonyClass: Harry.ExamHarmony
        # Configure callbacks
        afterInit: (options) =>
        afterInitMemory: (harmonies, search) =>
          for harmony in harmonies
            harmony._quality = fmtquality(harmony)
            this.addHarmony(harmony)
        afterNew: (harmony, search) =>
          harmony._quality = fmtquality(harmony)
          this.addHarmony(harmony)
        afterMilestone: (attrs) =>
          this.showInfo(attrs)
        )

