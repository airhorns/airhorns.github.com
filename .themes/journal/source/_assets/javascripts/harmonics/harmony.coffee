class Harry.Harmony
  constructor: (chord) ->
    @notes = []
    @noteIndicies = []
    for i, info of chord
      @notes[i] = info[0]
      @noteIndicies[i] = info[1]
 
  quality: ->
    @_quality ||= this.calculateQuality()
    @_quality

  calculateQuality: ->
    throw "Extend this class to define how a harmony's quality is evaluated"
