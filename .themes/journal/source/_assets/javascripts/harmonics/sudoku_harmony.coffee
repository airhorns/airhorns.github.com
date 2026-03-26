#Reference Type: Book Chapter
#Editor: Apolloni, Bruno
#Editor: Howlett, Robert
#Editor: Jain, Lakhmi
#Author: Geem, Zong
#Primary Title: Harmony Search Algorithm for Solving Sudoku
#Book Title: Knowledge-Based Intelligent Information and Engineering Systems
#Book Series Title: Lecture Notes in Computer Science
#Copyright: 2007
#Publisher: Springer Berlin / Heidelberg
#Isbn:
#Start Page: 371
#End Page: 378
#Volume: 4692
#Url: http://dx.doi.org/10.1007/978-3-540-74819-9_46
#Doi: 10.1007/978-3-540-74819-9_46
#Rights Link Reuse lisence 2632250476601

class Harry.SudokuHarmony extends Harry.Harmony
  unsolved: [] for i in [0..8]
  constructor: ->
    super
    k = 0
    @nums = []
    for row in [0..8]
      @nums[row] = []
      for col in [0..8]
        @nums[row][col] = if @unsolved[row][col]? then @unsolved[row][col] else @notes[k++]

  violations: ->
    @_violations ||= (135 - this.calculateQualityViolations())
    @_violations

  calculateQuality: -> this.calculateQualityUniq()

  calculateQualityViolations: ->
    135 - _.reduce(this.getViolations(), (acc, row) ->
      acc + _.reduce(row, (count, v) ->
        count + if v then 1 else 0
      , 0)
    , 0)

  calculateQualitySum: ->
    horiz = 0
    for row in [0..8]
      r = -45
      for col in [0..8]
        r += @nums[row][col]
      horiz += Math.abs(r)

    vert = 0
    for col in [0..8]
      c = -45
      for row in [0..8]
        c += @nums[row][col]
      vert += Math.abs(c)

    boxes = 0
    for box_x in [0..8] by 3
      for box_y in [0..8] by 3
        box = -45
        for row in [0..2]
          for col in [0..2]
            box += @nums[box_y+row][box_x+col]
        boxes += Math.abs(box)
    x = 135 - vert - horiz - boxes
    return x

  calculateQualityUniq: ->
    horiz = 0
    for row in [0..8]
     horiz += (9 - _.uniq(@nums[row]).length)

    vert = 0
    for col in [0..8]
      vert += (9 - _.uniq(@nums[row][col] for row in [0..8]).length)

    boxes = 0
    for box_x in [0..8] by 3
      for box_y in [0..8] by 3
        box = []
        for row in [0..2]
          for col in [0..2]
            box.push @nums[box_y+row][box_x+col]
        boxes += (9 - _.uniq(box).length)

    return 135 - vert - horiz - boxes

  getViolations: ->
    violations = []
    for y, row of @nums
      y = parseInt(y)
      violations[y] = []
      for x, val of row
        x = parseInt(x)
        # Determine if there is a row violation
        unless this.unsolved[y][x]?
          row_violation = false
          for other_x in [0..8]
            if other_x != x
              if @nums[y][other_x] == val
                row_violation = true
                break

          col_violation = false
          for other_y in [0..8]
            if other_y != y
              if @nums[other_y][x] == val
                col_violation = true
                break
          block_violation = do =>
            block_y = Math.floor(y / 3)*3
            block_x = Math.floor(x / 3)*3

            for other_y in [block_y..block_y+2]
              for other_x in [block_x..block_x+2]
                if other_y != y && other_x != x
                  if @nums[other_y][other_x] == val
                    return true
            return false
          violations[y][x] = row_violation || col_violation || block_violation
    violations

  showGame: ->
    unsolvedCount = 0
    violationsCount = 0
    violations = this.getViolations()
    s = "<table class=\"sudoku_game\">"
    for y, row of @nums
      y = parseInt(y)
      s += "<tr>"
      for x, val of row
        x = parseInt(x)
        # Determine if there is a row violation
        unless this.unsolved[y][x]?
          if @possibilities[unsolvedCount].length > 1
            if violations[y][x]
              violationsCount++
              cssClass = "violated"
            else
              cssClass = "good"
          else
            cssClass = "boring"
          unsolvedCount++
        else
          cssClass = "fixed"

        s += "<td class=\"#{cssClass}\">#{val}</td>"
      s += "</tr>"
    s += "</table>"
    s += "Violations: #{violationsCount}/#{unsolvedCount}. Quality: #{if _.isFunction(this.quality) then this.quality() else this.quality}"
    s
