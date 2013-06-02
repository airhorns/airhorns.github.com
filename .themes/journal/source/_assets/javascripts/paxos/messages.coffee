class Harry.AbstractMessage
  clone: ->
    clone = new @constructor
    for own k,v of @
      clone[k] = v
    clone

class Harry.PrepareMessage extends Harry.AbstractMessage
  constructor: (@sequenceNumber) -> super
  type: 1

class Harry.PromiseMessage extends Harry.AbstractMessage
  type: 2

class Harry.RejectProposalMessage extends Harry.AbstractMessage
  constructor: (highestSeenSequenceNumber) -> super
  type: 3

class Harry.AcceptMessage extends Harry.AbstractMessage
  constructor: (@sequenceNumber, @value) -> super
  type: 4

class Harry.QueryMessage extends Harry.AbstractMessage
  type: 6

class Harry.QueryResponseMessage extends Harry.AbstractMessage
  constructor: (@sequenceNumber, @value) ->
  type: 7

class Harry.SetValueMessage extends Harry.AbstractMessage
  constructor: (@value) ->
  type: 8

class Harry.SetValueResultMessage extends Harry.AbstractMessage
  constructor: (@error) ->
  type: 9

class Harry.GetValueMessage extends Harry.AbstractMessage
  type: 10
