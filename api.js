var request = require('request')
  , base = 'https://esb.isc-seo.upenn.edu/8091/open_data/course_section_search/'
// https://github.com/mikeal/request

// Step 1 of demoing request.
//request('http://www.google.com', function (err, response, body) {
//  console.log(body)
//})
//console.log('hi there!')

// Step 2: Let's try to hit the penn api!
function fetch (query, page, next) {
  	request({
	  url: base,
	  qs: {
	    course_id: query,
	    number_of_results_per_page: 50,
	    page_number: page
	  },
	  json: true,
	  headers: {
	    'Authorization-Bearer': 'UPENN_OD_emvP_1000783',
	    'Authorization-Token': 'a9oiq7rjn2pf6uc20vh2s8rcvi'
	  }
	}, next)
}

module.exports.getCourse = function (course, next) {
	fetch(course, 1, function (err, response, body) {
		if (err) {
			return next(err)
		}
		next(null, body.result_data)
	})
}

module.exports.courses = function (query, next) {
	var page = 1
	// Always fetch the first page
	fetch(query, 1, function (err, response, body) {
		var results = body.result_data
		  , total = body.service_meta.number_of_pages // how many more pages
		  , runs = 1

		if (total === 1) {
			// We're done. Only one page
			return next(null, results)
		}

		// More pages. Start at page 2, and go until the total
		for (var i = 2; i <= total; i++) {
			fetch(query, i, function (err, response, body) {
				if (err) {
					return next(err)
				}
				results = results.concat(body.result_data)
				// If we've run as many times as the total, we're done!
				if (++runs == total) {
					next(null, results)
				}
			})
		}
	})
}

/*
 * This function does the magic. It receives an array of courses
 * Each item in the array will be a string that represents the course name
 *		e.g. 'CIS120' or 'PHYS101'
 *
 * We have to fetch the course data for each of the courses, then determine
 * the best schedule!
 */
module.exports.generateSchedule = function (courses, next) {
	var total = courses.length
	  , runs = 0
	  , results = {} // key -> course name (CIS120), value -> Array of potential course options

	for (var i = 0; i < total; i++) {
		module.exports.getCourse(courses[i], done)
	}

	function done (err, resultData) {
		if (err) {
			return next(err)
		}
		var courseName = resultData[0].course_department + resultData[0].course_number
		results[courseName] = []
		results[courseName] = resultData

		if (++runs == total) {
			console.log('All data retrieved, generating the schedule!')
			// we fetched all!... generate schedule
			var schedule = [] // an array to hold the courses that will match
			  , totalCourses = Object.keys(results).reduce(function (prev, curr) {
			  	var additionalComponents = results[curr].reduce(function (p, c) {
			  		if (p) { return p }

			  		return hasAdditionalComponents(c)
			  	}, false)
			  	
			  	if (additionalComponents) {
			  		prev++
			  	} 
			  	return prev
			  }, courses.length)
			  
			// schedule -> Current schedule
			// courses -> Array of course ids e.g. ['CIS120', 'FNCE101']
			
			// Loop while we don't have a complete schedule.
			while (schedule.length !== totalCourses) {
				// Keep trying to get something that works

				// For each of the course ids 
				courses.forEach(function (course) {
					// Grab a lecture... look for a lecture that is okay with the current schedule...
					var lecture = getLecture(results[course], schedule)
					if (lecture) {
						// Then push it
						schedule.push(lecture)  // Always have a lecture
						// the more components for this course
						if (hasAdditionalComponents(lecture)) {
							var type = lecture.labs.length ? 'LAB' : 'REC'
							schedule.push(fetchAdditionalComponent(results[course], type, schedule))
						}	
					} else {
						// there are conflicts, so we need to keep trying
						schedule.length = 0
					}
					
				})
			}
			next(null, schedule)
		}
	}
}

function getLecture(courses, schedule) {
	// Find a lecture in the courses, and make sure there are no time conflicts w/ the current schedule.
	// We also want to introduce an element on randominess to this..
	var lectures = courses.filter(function (c) {
		var isLecture = c.activity === 'LEC'
		if (!isLecture) {
			return false
		}

		return filter(c, schedule)
	})

	// Random lecture that will work!
	return lectures[Math.floor(Math.random() * lectures.length)]
}

function filter(c, schedule) {
	// If the lecture is cancelled, we obviously can't use it
	if (c.course_status === 'X') {
		return false
	}

	// if the schedule is empty, all lectures will work
	if (schedule.length === 0) {
		return true
	}

	// Okay, the schedule is NOT empty, so see if this lecture will work for our schedule!
	var lectureMeeting = c.meetings[0]
	  , keep = false

	for (var i = 0; i < schedule.length; i++) {
		var scheduleItem = schedule[i]
		  , scheduleMeeting = scheduleItem.meetings[0]

		// meets on different days... so the lecture is okay
		for (var j = 0; j < lectureMeeting.meeting_days.length; j++) {
			var ld = lectureMeeting.meeting_days[j]
			if (scheduleMeeting.meeting_days.indexOf(ld) === -1 &&
				j + 1 === lectureMeeting.meeting_days.length) { 
				// not there
				keep = true
				continue
			}
		}

		// Meets on the same days, so check times
		if (lectureMeeting.start_time == scheduleMeeting.start_time ||
				lectureMeeting.end_time == scheduleMeeting.end_time) {
			keep = false
			break
		}

		if (lectureMeeting.end_time <= scheduleMeeting.start_time ||
				lectureMeeting.start_time >= scheduleMeeting.end_time) {
			keep = true
			continue
		}
	}
	
	return keep
}

/*
 * Receives the list of all possible courses (CIS120), and the lecture
 */
function fetchAdditionalComponent(all, type, schedule) {
	var filtered = all.filter(function (course) {
		if (course.activity !== type) {
			return false
		}

		return filter(course, schedule)
	})
	// Random course that will work!
	return filtered[Math.floor(Math.random() * filtered.length)]
}

function hasAdditionalComponents(course) {
	if (course.activity === 'LEC') {
		// It's a lecture, check if there are more requirements
		if (course.labs.length || course.recitations.length) {
			// It has more components
			return true
		}
	}
	return false
}
