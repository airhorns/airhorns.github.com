this.Harry = {}
importScripts("/js/jquery.hive.pollen.js", "/js/underscore.js", "/js/harmonics/harmony.js", "/js/harmonics/harmony_search.js", "/js/harmonics/sudoku_puzzle.js", "/js/harmonics/sudoku_harmony.js")
puzzle = false
sudokuSearch = false

prepareHarmony = (harmony) ->
  harmony.wire_quality = harmony.quality()
  harmony

$ (data) ->
  switch data.type
    when "init"
      puzzle = new Harry.SudokuPuzzle(data.options.puzzle)
      
      options = _.extend data.options,
        popStack: 100
        harmonyClass: puzzle.harmonyClass()
        afterInitMemory: (harmonies, search) =>
          for harmony in harmonies
            $.send
              type: "init_harmony"
              harmony: prepareHarmony(harmony)

        afterNew: (harmony, search) =>
          $.send
            type: "add_harmony"
            harmony: prepareHarmony(harmony)

        afterMilestone: (attrs) =>
          attrs.worst = prepareHarmony(attrs.worst)
          attrs.best = prepareHarmony(attrs.best)
          $.send
            type: "milestone"
            attrs: attrs

      sudokuSearch = new Harry.HarmonySearch(options)
    when "start"
      sudokuSearch.search()
    when "stop"
      sudokuSearch.stop()
