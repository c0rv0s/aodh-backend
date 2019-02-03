let express = require('express')
let bodyParser = require('body-parser')
let morgan = require('morgan')
let pg = require('pg')
const PORT = 3000

//email stuff
const creds = require('./config/config')
var nodemailer = require('nodemailer');

var transport = {
  host: 'smtp.gmail.com',
  auth: {
    user: creds.USER,
    pass: creds.PASS
  }
}

var transporter = nodemailer.createTransport(transport)

transporter.verify((error, success) => {
  if (error) {
    console.log(error);
  } else {
    console.log('Server is ready to take messages');
  }
});
//end email stuff

let pool = new pg.Pool({
	port: 5432,
	user: 'aodh',
	password: 'helloaodh',
	database: 'postgres',
	idleTimeoutMillis: 1500, 
  	connectionTimeoutMillis: 1500, 
	host: '127.0.0.1'
})

var table_height
pool.connect((err, db, done) => {
  if (err) {
    return console.log(err)
  }
  else {
    //print first entry from postgres on connect
    db.query('SELECT COUNT(*) FROM discover', (err, table) => {
      done()
      if (err) {
        return console.log(err)
      }
      else {
	console.log('postgres connection success')
        table_height = table.rows[0].count 
     }
    })
  }
})		

let app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.use(morgan('dev'))

app.use(function(req, res, next) {
  res.header("Allow-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  next()
})

app.post('/api/contact', function(req,res) {
  var name = req.body.name
  var email = req.body.email
  var message = req.body.message
  var content = `name: ${name} \n email: ${email} \n message: ${message} `
  var mail = {
    from: name,
    to: 'c0rv0s.trash@gmail.com',
    subject: 'New Message from Aodh Contact',
    text: content
  }
  transporter.sendMail(mail, (err, data) => {
    if (err) {
      res.json({
        msg: 'fail'
      })
    } else {
      res.json({
        msg: 'success'
      })
    }
  })
  
})

app.post('/api/add_user', function(req, res) {
  var username = req.body.username
  pool.connect(function(err, db, done) {
    if (err) {
      return res.status(400).send(err)
    }
    else {

      db.query('SELECT COUNT(*) FROM discover', (err, table) => {
        if (err) {
          return console.log(err)
        }
        else {
          table_height = parseInt(table.rows[0].count)
	  
          db.query('INSERT INTO discover VALUES ($1, $2, 0, 0) ON CONFLICT (username) DO NOTHING', [table_height, username], function(err,table) {
            done()
            if (err) {
              return res.status(400).send(err)
            }
            else {
              return res.status(200).send()
            }
          })


       }
      })
    }
  })
})

app.post('/api/user', function(req,res) {
  var new_val = req.body.val
  var username = req.body.username
  pool.connect(function(err, db, done) {
    if (err) {
      return res.status(400).send(err)
    }
    else {
      db.query('UPDATE discover SET discoverable = $1 WHERE username = $2', [new_val,username], function(err,table) {
        done()
        if (err) {
          return res.status(400).send(err)
        }
        else {
          return res.status(200).send()
        }
      })
    }
  })
})

app.post('/api/change_posts', function(req,res) {
  var val = req.body.val
  var username = req.body.username

  pool.connect(function(err, db, done) {
    if (err) {
      return res.status(400).send(err)
    }
    else {
      db.query('SELECT posts FROM discover WHERE username = $1', [username], function(err, table) {
	if (err) {
	  return res.status(400).send(err)
	}
	else {
	  val += table.rows[0].posts 
	  console.log(val)
	  db.query('UPDATE discover SET posts = $1 WHERE username = $2', [val,username], function(err,table) {
            done()
            if (err) {
		console.log(err)
             return res.status(400).send(err)
            }
            else {
             return res.status(200).send()
            }
          })
	}
      })
    }
  })

})

app.get('/api/fetch_user', function(req, res) {
  var username = req.query.username + '.id.blockstack'
  pool.connect(function(err, db, done) {
    if (err) {
      return res.status(400).send(err)
    }
    else {
      db.query("SELECT discoverable FROM discover WHERE username = $1",[username], function(err,table) {
        done()
        if (err) {
          return res.status(400).send(err)
        }
        else {
          return res.status(200).send(table.rows[0])
        }
      })
    }
  })
})

app.post('/api/list_ten', function(req, res) {
  var cur_d = req.body.d
  pool.connect(function(pool_err, db, done) {
    if (pool_err) {
      return res.status(400).send(pool_err)
    }
    else {
      db.query('SELECT COUNT(*) FROM discover', (err, table) => {
         if (err) {
           return console.log(err)
         }
         else {
           table_height = table.rows[0].count
         }
      })
      var id_array = []
      var data
        var i = 0
        var miss = 0   
        while(i < 8) {
          var ranNum = Math.floor(Math.random() * table_height)
	  if (!cur_d.includes(ranNum)) {
            id_array.push(ranNum)
            i += 1
	  }
	  else
	    miss += 1
	  if (miss === 100){
	    console.log('ran out of users')
	    break
	  }
        }
        db.query('SELECT * FROM discover WHERE discoverable = 1 AND id IN($1,$2,$3,$4,$5,$6,$7,$8)',id_array, function(err,table) {
          if (err) {
            return res.status(400).send(err)
          }
          else {
	   data = {ids: id_array, rows: table.rows}
//	   console.log(table.rows)
	   done()
      return res.status(200).send(data)
          }
        })
    }
  })
})


app.listen(PORT, () => console.log('listening on port ' + PORT))


