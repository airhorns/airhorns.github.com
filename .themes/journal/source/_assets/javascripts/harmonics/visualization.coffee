class Harry.HarmonySearchVisualizer
  @defaults: {}
  constructor: (options)->
    # Set up options
    @options ||= _.extend({}, HarmonySearchVisualizer.defaults, options)

    # Set up elements
    @div = $("##{@options.id}").addClass("sudoku_vis")
    @visId = @options.id + "_vis"
    @vis2Id = @options.id + "_vis2"
    @controls = $("<div class=\"controls\"></div>").appendTo(@div)
    @info = $("<div class=\"info\"></div>").appendTo(@controls)
    @div.append("<div id=\"#{@visId}\" class=\"wheel\"></div>")
    @game = $("<div id=\"#{@options.id}_game\" class=\"game\"></div>").appendTo(@div)
    @div.append("<div id=\"#{@vis2Id}\" class=\"create\"></div>")

    # Create startstop button which pauses or resumes computation
    @startstop = $("<button class=\"awesome\">#{if @options.startOnInit then "Pause" else "Start"}</button>").appendTo(@controls).click =>
      if @running
        this.stop()
        @startstop.html("Start")
      else
        this.start()
        @startstop.html("Pause")

    # Starts and restarts the vis
    @restartVis = () =>
      # Storage for harmonies on display and rows visible
      if @running
        if @options.computationMode?.webworkers
          @hive.terminate()
        else
          @search.stop()
      delete @best
      delete @worst
      delete @bestViolations

      @harmonies = []
      @rows = 0
      this._initializeSearch()
      this._initializeMemoryVisualization()
      this._initializeCreationVisualization()

      # Start the algo so the vis shows up, but stop it right after
      this.start()
      this.stop()

    # Create reset button
    @reset = $('<button class="awesome">Reset</button>').appendTo(@controls).click =>
      before_restart = @running
      @restartVis()
      this.start() if before_restart

    # Activity Indicator
    @activityIndicator = $('<img class="working" src="/images/working.gif">').hide().appendTo(@controls)

    # Init vis
    @restartVis()

  # Callback for the search class to add a harmony to the vis
  addHarmony: (harmony) ->
    @harmonies.push harmony

    # Unseat the worst of the bunch to be replaced by this one
    if @rows > @options.maxRows
      minIndex = 0
      secondMinIndex = 0
      minQuality = @harmonies[0]._quality

      for i, harmony of @harmonies
        if harmony._quality <= minQuality
          secondMinIndex = minIndex
          minQuality = harmony._quality
          minIndex = i

      @harmonies.splice(minIndex, 1)
      @worst = @harmonies[secondMinIndex] # Track the worst harmony quality wise
    else
      @rows++

    # Track the best harmonies quality wise and violations wise
    @best ?= harmony

    if @best._quality < harmony._quality
      @best = harmony
      this.showSolution(harmony)
    
    this.render()

    if @best._quality >= @options.targetQuality
      this.finished()

  stop: ->
    @search.stop()
    @running = false
    @activityIndicator.hide()
    true

  start: ->
    @search.search()
    @running = true
    @activityIndicator.show()
    true

  finished: ->
    this.stop()

  showSolution: (harmony, forceRender = false) ->
    throw "Unimplemented"

  showInfo: (attrs) ->
    s = "Try #{attrs.tries}. "
    s += "Best: #{attrs.best._quality}. " if attrs.best?
    s += "Worst: #{attrs.worst._quality}." if attrs.worst?
    @info.html(s)

  render: () ->
    @vis.render()
    @vis2.render()

  _initializeSearch: ->
    throw "Unimplemented"

  _initializeMemoryVisualization: ->
    # Set up Protovis wedge display
    inner = @options.width/2 - @options.thickness - @options.edgeOffset
    minimum = @options.thickness - @options.thicknessScale
    @options.colorScale = pv.Scale.linear(2*@options.targetQuality/3, @options.targetQuality).range('white', 'purple')

    @vis = new pv.Panel()
      .width(@options.width)
      .height(@options.height)
      .canvas(@visId)

    # Ring of wedges showing harmony memory
    @vis.add(pv.Wedge)
      .data(=> @harmonies)
      .left(@options.width/2)
      .bottom(@options.height/2)
      .innerRadius(inner)
      # Grow each wedge inversely proportional to the violations
      .outerRadius((d) =>
        return inner + @options.thickness if !@bestViolations? || d.violations() == 0
        size = @options.thicknessScale * (@bestViolations.violations() / d.violations())
        return inner + minimum + size
      )
      # Every wedge has the same angle
      .angle((d) => -2 * Math.PI / @harmonies.length)
      # Make the wedges get progressively more red as they grow in quality
      .fillStyle((d) =>
        if d._quality >= @options.targetQuality
          "#A0FF8C"
        else
          @options.colorScale(d._quality)
      )
      .strokeStyle("white")
      .lineWidth(1)
      # Show a harmony's game when clicked
      .event("click", (x) => this.showSolution(x, true))
    .anchor("center").add(pv.Label)
      .font("8pt Droid Sans")
      .textAngle(0)
      .text((d) -> d._quality)

    # Wedge which points to solution, showing which one is currently displayed.
    @vis.add(pv.Wedge)
      .data(=> @harmonies)
      .left(@options.width/2)
      .bottom(@options.height/2)
      .outerRadius(inner-1)
      .innerRadius((d) =>
        if @showing? and d == @showing
          0
        else
          inner-1
      )
      .angle((d) => -2 * Math.PI / @harmonies.length)
      .fillStyle("#CCC")

    # Wedge which shows the current best and worst
    # Ring of wedges showing harmony memory
    @vis.add(pv.Wedge)
      .data(=> @harmonies)
      .left(@options.width/2)
      .bottom(@options.height/2)
      .angle((d) => -2 * Math.PI / @harmonies.length)
      .outerRadius(inner-1)
      .innerRadius((d) =>
        if (@best? and d._quality == @best._quality) or (@worst? and d._quality == @worst._quality)
          inner-5
        else
          inner-1
      )
      # Highlight the best wedges
      .fillStyle((d) =>
        if @best? and d._quality == @best._quality
          "green"
        else if @worst? and d._quality == @worst._quality
          "red"
        else
          "white"
      )

  _initializeCreationVisualization: () ->
    # Height
    height = @options.creationVis.height
    # Each row has a height
    rowHeight = @options.creationVis.rowHeight
    # Each column has a width
    cellWidth = @options.creationVis.cellWidth
    # The table is only so wide
    maxCols = @options.creationVis.maxCols
    # The first coumn has the quality of the function in it
    firstColWidth = @options.creationVis.firstColWidth

    # The rows start far enough down for the random selections at the top to fit
    randomsRowHeight = 20
    possibilities = if @puzzle?
      @puzzle.possibilities
    else
      [@search.options.notes for i in @search.options.instruments]

    maxPossibilities = _(possibilities[0..maxCols]).chain().map((x) -> x.length).max().value()
    boxPadding = maxPossibilities * randomsRowHeight + 10

    # Max rows that will fit
    rows = Math.floor( (height - boxPadding) / rowHeight )
    colorScale = pv.Scale.linear(0, rows-1).range("#000", "#666")

    @vis2 = new pv.Panel()
      .width(450)
      .height(height)
      .canvas(@vis2Id)

    # Add rows for each harmony in the memory
    row = @vis2.add(pv.Panel)
          .data(=> @harmonies.slice().reverse()[0..rows-1])
          .height(rowHeight - 3)
          .top(-> this.index * (rowHeight) + boxPadding)
          .strokeStyle("#CCC")
          .lineWidth(1)

    proto = new pv.Label()
      .top(6)
      .font("10pt Droid Sans")
      .textBaseline("top")
      .textStyle("#000")

    # Labels at the start of each row for the quality
    row.add(pv.Label)
      .extend(proto)
      .data((harmony) -> [harmony._quality])
      .left(0)
      .text((d) -> "#{d}:")

    # Labels in the row for the value of each note
    search = this
    textColorScale = pv.Scale.linear(0, rows).range("#000", "#AAA")
    row.add(pv.Label)
      .extend(proto)
      .data((harmony) -> harmony.notes[0..maxCols])
      .left(-> firstColWidth + this.index * cellWidth)
      .font((d) ->
        extra = ""
        if x = search.harmonies[search.harmonies.length-1].creationAnnotations
          if x[this.index].fromMemory && x[this.index].memoryIndex == this.parent.index - 1
            extra = "bold "
        if this.parent.index == 0
          extra = "bold "
        "#{extra}10pt Droid Sans"
      ).textStyle((d) ->
        if x = search.harmonies[search.harmonies.length-1].creationAnnotations
          if x[this.index].fromMemory && x[this.index].memoryIndex == this.parent.index - 1
            return "#000"
        if this.parent.index == 0
          return "#000"
        return textColorScale(this.parent.index)
      )

    # Fixed labels at the top for the random lines to point to
    randoms = @vis2.add(pv.Panel)
      .data(possibilities[0..maxCols])
      .width(cellWidth)
      .height(maxPossibilities * randomsRowHeight)
      .top(0)
      .left(-> firstColWidth + this.index * cellWidth)

    randoms.add(pv.Label)
      .data((possibilities) -> possibilities)
      .font((d) ->
        extra = ""
        if x = search.harmonies[search.harmonies.length-1].creationAnnotations
          if x[this.parent.index].random && x[this.parent.index].noteIndex == this.index
            extra = "bold "
        "#{extra}10pt Droid Sans"
      )
      .textStyle("#000")
      .left(0)
      .height(rowHeight)
      .bottom((d) -> this.index * randomsRowHeight)


    # Lines pointing from the first row's notes to the (pitch adjusted) notes they came from or the random one that was picked
    @vis2.add(pv.Panel)
      .data(=>
        if (x = @harmonies[@harmonies.length-1].creationAnnotations)
          x[0..33]
        else
          []
      )
      .left(-> firstColWidth + this.index * cellWidth + 7)
      .add(pv.Wedge)
        .strokeStyle( (d) ->
          if d.fromMemory
            if d.pitchAdjusted
              "rgba(0,0,255,0.5)"
            else
              "rgba(0,0,0,0.5)"
          else
            "rgba(155,0,155,0.5)"
        )
        .outerRadius((d) ->
          if d.fromMemory
            d.memoryIndex * rowHeight + 14
          else
            d.noteIndex * randomsRowHeight + 16
        )
        .startAngle((d) ->
          unless d.fromMemory
            Math.PI/-2
          else
            Math.PI/2
        )
        .angle(0)
        .top((d) ->
          if d.fromMemory
            boxPadding + rowHeight - 8
          else
            boxPadding + 6
        )


