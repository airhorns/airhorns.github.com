#= require vendor/jquery.hive
#= require vendor/underscore
#= require vendor/protovis-d3.2
#= require harmonics/harmony
#= require harmonics/harmony_search
#= require harmonics/sudoku_puzzle
#= require harmonics/sudoku_harmony
#= require harmonics/visualization
#= require harmonics/sudoku_visualization
#= require harmonics/exam_visualization

heatmapExample = new Harry.HeatmapVisualizer

heatmapSearch = new Harry.HeatmapSearchVisualizer
  id: 'examsearchVis'

sudoku = new Harry.SudokuVisualizer
  id: 'searchVis'
