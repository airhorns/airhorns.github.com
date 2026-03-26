class Harry.SudokuVisualizer extends Harry.HarmonySearchVisualizer
  @computationModes:
    "light":
      workers: false
      timer: 150
      milestoneInterval: 10
      enabled: true

    "medium":
      workers: false
      timer: 40
      milestoneInterval: 60
      enabled: true

    "heavy":
      workers: false
      timer: 0
      milestoneInterval: 100
      enabled: true

    "poutine":
      workers: true
      milestoneInterval: 1000
      enabled: Modernizr.webworkers

  @defaults:
    width: 500
    height: 500
    thickness: 70
    edgeOffset: 10
    thicknessScale: 30
    targetQuality: 135
    id: false
    maxExtraRows: 0
    startOnInit: false
    computationMode: "light"
    puzzle: "geem"
    creationVis:
      height: 500
      rowHeight: 28
      cellWidth: 12
      maxCols: 33
      firstColWidth: 30

  @puzzles:
    "stupid easy": "8...37429743.9286..52..4371.8524.7933..87615..74.5968...7465938.369..2474987..516"
    "easy": ".6...14.98......7...16.93..43...7..22..9....7.18......1...2........4..........8.."
    "geem": ".5.3.6..7....85.24.9842.6.39.1..32.6.3.....1.5.726.9.84.5.9.38..1.57...28..1.4.7."
    "hard": "164....79....3......9...6.53...2...1......432....6.....96.53.....7..4........9.5."
    "starburst": "9..1.4..2.8..6..7..........4.......1.7.....3.3.......7..........3..7..8.1..2.9..4"

  constructor: (options)->
    # Set up options
    @options = _.extend({}, SudokuVisualizer.defaults, options)
    @options.computationMode = SudokuVisualizer.computationModes[@options.computationMode]
    @options.puzzle = SudokuVisualizer.puzzles[@options.puzzle]
    
    super

    # Create mode select button and register change event
    @controls.append("Computation Intensity: ")
    @modeSelect = $('<select class="mode"></select>')
    for name, mode of SudokuVisualizer.computationModes
      if mode.enabled
        @modeSelect.append("<option #{if mode == @options.computationMode then "selected" else ""}>#{name}</option>")

    @modeSelect.appendTo(@controls).change (e) =>
      @options.computationMode = SudokuVisualizer.computationModes[@modeSelect.val()]
      before_restart = @running
      @restartVis()
      this.start() if before_restart
      true

    # Create puzzle select button and register change event
    @controls.append("Puzzle: ")
    @puzzleSelect = $('<select class="puzzle"></select>')
    for name, puzzle of SudokuVisualizer.puzzles
      @puzzleSelect.append("<option #{if puzzle == @options.puzzle then "selected" else ""} value=\"#{puzzle}\">#{name}</option>")

    @puzzleSelect.appendTo(@controls).change (e) =>
      @options.puzzle = @puzzleSelect.val()
      before_restart = @running
      @restartVis()
      this.start() if before_restart
      true

    this.start() if @options.startOnInit
    true

  stop: ->
    if @options.computationMode.workers
      @hive.send
        type: "stop"
    else
      @search.stop()
    @running = false
    @activityIndicator.hide()
    true

  start: ->
    if @options.computationMode.workers
      @hive.send
        type: "start"
    else
      @search.search()
    @running = true
    @activityIndicator.show()
    true
  
  addHarmony: (harmony) ->
    super
    @bestViolations ?= harmony
    if @bestViolations.violations() > harmony.violations()
      @bestViolations = harmony
    
  showSolution: (harmony, forceRender = false) ->
    @showing = harmony
    @game.html(harmony.showGame())
    this.render() if forceRender

  _initializeSearch: ->
    # Set up search
    @puzzle = new Harry.SudokuPuzzle(@options.puzzle)
    options =
      # Configure search for sudoku
      maxTries: 1000000
      targetQuality: 135
      harmonyMemoryConsiderationRate: .7
      pitchAdjustmentRate: .1
      notesGlobal: false
      notes: @puzzle.possibilities
      harmonyMemorySize: 16
      instruments: @puzzle.unsolvedCount
      # Pull out the user selected values
      timer: @options.computationMode.timer || 0
      iterationMilestone: @options.computationMode.milestoneInterval

    @harmonyClass = @puzzle.harmonyClass()
    @options.maxRows = options.harmonyMemorySize

    # Set up the jQuery.Hive webworker messaging bus if supported
    if @options.computationMode.workers
      getHarmony = (data) =>
        harmony = new @harmonyClass(_.zip(data.notes, data.noteIndicies))
        harmony._quality = data.wire_quality
        harmony.creationAnnotations = data.creationAnnotations
        harmony

      jQuery.Hive.create
        worker: '/js/harmonics/sudoku_worker.js'
        created: (hive) =>
          @hive = hive[0]
          @hive.send
            type: "init"
            options: _.extend(options,
              maxTries: 100000000 # wooohoooo
              puzzle: @options.puzzle # raw text that the worker parses into its own Harry.Puzzle
              iterationMilestone: 1000
              popStack: 500
            )
        receive: (data) =>
          switch data.type
            when "init"
              true
            when "add_harmony", "init_harmony"
              harmony = getHarmony(data.harmony) # Massage wire data
              this.addHarmony(harmony)
            when "milestone"
              attrs = data.attrs
              attrs.best = getHarmony(attrs.best) # Massage wire data
              attrs.worst = getHarmony(attrs.worst) # Massage wire data
              this.showInfo(data.attrs)
            when "console", "message"
              console.log(data)
            else
              console.error "Unrecognized message!"
              console.error(data)
    else
      # No webworker support, run the search in this thread with deferring of the iterations
      @search = new Harry.HarmonySearch _.extend(options,
        harmonyClass: @harmonyClass
        # Configure callbacks
        afterInit: (options) =>
        afterInitMemory: (harmonies, search) =>
          for harmony in harmonies
            harmony._quality = harmony.quality()
            this.addHarmony(harmony)
        afterNew: (harmony, search) =>
          harmony._quality = harmony.quality()
          this.addHarmony(harmony)
        afterMilestone: (attrs) =>
          this.showInfo(attrs)
        )
