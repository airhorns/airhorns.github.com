class Harry.SudokuPuzzle
  constructor: (puzzle) ->
    @puzzle = puzzle
        # Calculate where the unknowns in the puzzle are. While doing so
    # generate an ordered list of where the notes in the harmony should
    # go in the puzzle
    @unsolvedCount = 0
    @nums = []
    for row in [0..8]
      @nums[row] = []
      for col in [0..8]
        char = @puzzle.charAt(row*9+col)
        if char == "."
          @unsolvedCount++
        else
          @nums[row][col] = parseInt(char)

    @possibilities = this.getPossibilities()

    
  harmonyClass: ->
    c = @unsolvedCount
    n = @nums
    p = @possibilities
    class PuzzleSolver extends Harry.SudokuHarmony
      @unsolvedCount: c
      possibilities: p
      unsolved: n

    return PuzzleSolver

  getPossibilities: ->
    acc = []
    for y, row of @nums
      y = parseInt(y)
      for x in [0..8]
        unless row[x]?
          # Unknown. Enumerate others in row, col, and box to eliminate possibilties
          possible = [true,true,true,true,true,true,true,true,true]
          for other_x, other_row_val of row
            if other_x != x
              possible[other_row_val-1] = false

          for other_y_index in [0..8]
            if other_y_index != y && @nums[other_y_index]?[x]?
              possible[@nums[other_y_index][x]-1] = false


          block_y = Math.floor(y / 3)*3
          block_x = Math.floor(x / 3)*3

          for other_y in [block_y..block_y+2]
            for other_x in [block_x..block_x+2]
              if other_y != y && other_x != x
                possible[@nums[other_y][other_x]-1] = false

          possible_vals = []
          for valp, possibility of possible
            possible_vals.push(parseInt(valp)+1) if possibility

          acc.push possible_vals

    acc
