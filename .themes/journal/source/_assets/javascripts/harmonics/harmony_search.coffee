class Harry.HarmonySearch
  @defaults:
    maxTries: 100
    iterationMilestone: 100
    targetQuality: Infinity
    harmonyMemorySize: false
    harmonyMemoryConsiderationRate: .95
    pitchAdjustmentRate: .1
    randomAllocationMultiplier: 3
    instruments: false
    notes: false
    notesGlobal: true
    harmonyClass: false
    harmonyMemorySize: 10
    popStack: 1
    timer: 0
    afterInit: ->
    afterInitMemory: ->
    afterNew: ->

  constructor: (options) ->
    @options = _.extend {}, HarmonySearch.defaults, options
    @options.notesLength = @options.notes.length
    this.options.afterInit(@options, this)
    @running = true

  stop: () ->
    @running = false
    clearTimeout(@timer)

  start: () ->
    this.search()

  search: (callback) ->
    # Initialize harmony memory
    @running = true
    unless @harmonyMemory?
      randoms = for i in [1..@options.harmonyMemorySize*@options.randomAllocationMultiplier]
        this.getRandomHarmony()

      randoms.sort (a,b) ->
        return b.quality() - a.quality()

      @harmonyMemory = randoms.slice(0, @options.harmonyMemorySize)
      @options.afterInitMemory(@harmonyMemory, this)
      @tries ?= 0
      @ret = =>
        [bestQuality, bestIndex] = this._getBest()

        vals =
          harmonies: @harmonyMemory
          bestQuality: bestQuality
          best: @harmonyMemory[bestIndex]
          worstQuality: worstQuality
          worst: @harmonyMemory[worstIndex]
          tries: @tries
        @options.afterMilestone(vals)
        callback(vals) if callback?

    [worstQuality, worstIndex] = this._getWorst()
    [bestQuality, bestIndex] = this._getBest()

    # Iterate over the search until either the target quality is hit,
    # or the max iterations condition is passed.
    iterate = =>
      if @tries > @options.maxTries || bestQuality >= @options.targetQuality
        @ret()
        return true
      if @tries % @options.iterationMilestone == 0
        [bestQuality, bestIndex] = this._getBest()

        @options.afterMilestone
          tries: @tries
          best: @harmonyMemory[bestIndex]
          worst: @harmonyMemory[worstIndex]

      harmony = this.getNextHarmony()
      if harmony.quality() > worstQuality
        # Better than worst harmony. Swap out.
        @harmonyMemory.push(harmony)
        @harmonyMemory.splice(worstIndex, 1)
        @options.afterNew(harmony, this)
        #delete harmony.creationAnnotations

        if harmony.quality() > bestQuality
          bestQuality = harmony.quality()

        [worstQuality, worstIndex] = this._getWorst()
      @tries++
      if @tries % @options.popStack == 0
        @timer = setTimeout(iterate, @options.timer)
      else
        iterate()
      true

    iterate()
    true

  # Get the quality and index of the worst harmony in the memory
  _getWorst: ->
    this._getComp(((a,b) -> a < b ), Infinity)

  _getBest: ->
    this._getComp(((a,b) -> a > b ), 0)

  # Generate a totally random harmony
  getRandomHarmony: ->
    chord = for i in [0..@options.instruments-1]
      if @options.notesGlobal
        index = Math.floor(Math.random() * @options.notesLength)
        [@options.notes[index], index]
      else
        index = Math.floor(Math.random() * @options.notes[i].length)
        [@options.notes[i][index], index]

    new @options.harmonyClass(chord)

  # Generate a new harmony based on the HMCR and the PAR
  getNextHarmony: ->
    creationAnnotations = []
    chord = for i in [0..@options.instruments-1]
      annotation = creationAnnotations[i] = {}

      # Quick check for simple cases
      if @options.notesGlobal and @options.notes[i].length == 1
        [@options.notes[i][0], 0]
      else
        # Not simple, do HMCR & PAR
        if Math.random() < @options.harmonyMemoryConsiderationRate
          # Consider HM. Pick a random harmony, and sample the note at this position in the chord
          harmonyMemoryIndex = Math.floor(Math.random()*@options.harmonyMemorySize)
          note = @harmonyMemory[harmonyMemoryIndex].notes[i]
          noteIndex = @harmonyMemory[harmonyMemoryIndex].noteIndicies[i]
          annotation.fromMemory = true
          annotation.memoryIndex = harmonyMemoryIndex
          if Math.random() < @options.pitchAdjustmentRate
            # Adjust the pitch up or down one
            annotation.pitchAdjusted = true
            annotation.adjustment = if Math.random() > 0.5 then 1 else -1
            annotation.oldNoteIndex = noteIndex
            if @options.notesGlobal
              noteIndex = (noteIndex + annotation.adjustment + @options.notesLength) % @options.notesLength
              note = @options.notes[noteIndex]
            else
              noteIndex = (noteIndex + annotation.adjustment + @options.notes[i].length) % @options.notes[i].length
              note = @options.notes[i][noteIndex]

        else
          # Don't consider the HM. Pick a random note from all possible values.
          if @options.notesGlobal
            noteIndex = Math.floor(Math.random() * @options.notesLength)
            note = @options.notes[noteIndex]
          else
            noteIndex = Math.floor(Math.random() * @options.notes[i].length)
            note = @options.notes[i][noteIndex]

          annotation.random = true
          annotation.pick = note
        annotation.noteIndex = noteIndex
        # Return chosen note for the chord
        [note, noteIndex]

    harmony = new @options.harmonyClass(chord)
    harmony.creationAnnotations = creationAnnotations
    harmony

  _getComp: (comp, start) ->
    quality = start
    index = -1
    for i, harmony of @harmonyMemory
      if comp(harmony.quality(), quality)
        quality = harmony.quality()
        index = i

    [quality, index]
