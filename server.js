var http = require('http')
  , url = require('url')
  , fs = require('fs')
  , api = require('./api')

http.createServer(function (req, res) {
  var _url = url.parse(req.url, true)
    , pathname = _url.pathname

  if (pathname == '/typeahead.js') {
  	return fs.createReadStream(__dirname + '/typeahead.js').pipe(res)
  }

  if (pathname == '/style.css') {
    return fs.createReadStream(__dirname + '/style.css').pipe(res)
  }

  if (pathname == '/schedule') {
    console.log("schedule node")
    var courses = _url.query['courses[]'] // some weird jquery issue is forcing us to say courses[] 

    if (typeof courses === 'string') {
      courses = [courses] // convert to an array
    }
    return api.generateSchedule(courses, function (err, schedule) {
      if (err) {
        return res.end(err.message)
      }
      res.end(JSON.stringify(schedule))
    })
  }

  if (pathname == '/courses') {
  	var course = _url.query.query // what the user typed (what we have to send to penn)
  	api.courses(course, function (err, courses) {
  		if (err) {
  			return res.end('No bueno')
  		}

  		var response = courses.map(function (course) {
  			return course.course_department + course.course_number
  		}).filter(function (course, pos, ar) {
  			return ar.indexOf(course) == pos
  		})
  		
  		return res.end(JSON.stringify(response))
  	})
  } else {
  	fs.createReadStream(__dirname + '/index.html').pipe(res)	
  }
  
}).listen(3000)
