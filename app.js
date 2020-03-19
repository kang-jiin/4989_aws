const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const multer = require('multer')
const session = require('express-session');

const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
var upload = multer({ dest: 'uploads/' });

app.locals.pretty = true;
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static('public'));

app.use(session({
    secret: '@#@$MYSIGN#@$#$',
    resave: false,
    saveUninitialized: true
}));

app.use(function(req, res, next) {
    res.locals.user = req.session;
    next();
});

app.set('views', './views');
app.set('view engine', 'ejs');

//-----------DB------------------
const connection = mysql.createConnection({
    host: '183.101.196.138',
    user: 'admin4989',
    password: 'admin4989',
    database: 'auction4989'
});

connection.connect((err) => {
    if (err) {
        console.log(err);
        throw err;
    }
    console.log('connerct success : ' + connection.threadId);
});
//-----------DB------------------



app.get(['/', '/list/main/pag/:page'], (req, res) => {
    let page = req.params.page;
    let key = "%" + req.query.keyword + "%";
    let hot_item = `
        select id, hit, format(max_price, 0) price, end_time
        from item
        order by hit desc
    `;
    let category_item = `
        select id, category, hit, format(max_price, 0) price, end_time
        from item
        where title like ?
        order by id desc
        LIMIT ?, ?
    `;
    let item_count = `
        select count(*) as num
        from item
    `;
    if (page == undefined || page == 1) {
        connection.query(hot_item, (err, h_results, fields) => {
            if (err) {
                console.log(err);
                res.status(500).send('Internal Server Error!!!')
            }
            connection.query(category_item, [key, 0, 9], (err, c_results, fields) => {
                if (err) {
                    console.log(err);
                    res.status(500).send('Internal Server Error!!!')
                }
                connection.query(item_count, (err, countse, fields) => {
                    if (err) {
                        console.log(err);
                        res.status(500).send('Internal Server Error!!!')
                    }
                    res.render('main', { h_article: h_results, c_article: c_results, category: 'main', cont: parseInt(countse[0].num) / 10 });
                });
            });
        });
    } else {
        connection.query(hot_item, (err, h_results, fields) => {
            if (err) {
                console.log(err);
                res.status(500).send('Internal Server Error!!!')
            }
            connection.query(category_item, [key, (page * 9) - 9, 9], (err, c_results, fields) => {
                if (err) {
                    console.log(err);
                    res.status(500).send('Internal Server Error!!!')
                }
                connection.query(item_count, (err, countse, fields) => {
                    if (err) {
                        console.log(err);
                        res.status(500).send('Internal Server Error!!!')
                    }
                    res.render('main', { h_article: h_results, c_article: c_results, category: 'main', cont: parseInt(countse[0].num) / 10 });
                });
            });
        });
    }
})

app.get(['/list/:category', '/list/:category/pag/:page'], (req, res) => {
    let page = req.params.page;
    let category = req.params.category;
    sess = req.session;
    let hot_item = `
        select id, hit, format(max_price, 0) price, timediff(end_time, now()) time
        from item
        order by hit desc
    `;
    let category_item = `
        select id, category, hit, format(max_price, 0) price, timediff(end_time, now()) time
        from item
        where category = ?
        LIMIT ?, ?
    `;
    let item_count = `
        select count(*) as num
        from item
        where category = ?
    `;
    if (page == undefined || page == 1) {
        connection.query(hot_item, (err, h_results, fields) => {
            if (err) {
                console.log(err);
                res.status(500).send('Internal Server Error!!!')
            }
            connection.query(category_item, [category, 0, 9], (err, c_results, fields) => {
                if (err) {
                    console.log(err);
                    res.status(500).send('Internal Server Error!!!')
                }
                connection.query(item_count, category, (err, countse, fields) => {
                    if (err) {
                        console.log(err);
                        res.status(500).send('Internal Server Error!!!')
                    }
                    res.render('main', { h_article: h_results, c_article: c_results, category: category, cont: parseInt(countse[0].num) / 10 });
                });
            });
        });
    } else {
        connection.query(hot_item, (err, h_results, fields) => {
            if (err) {
                console.log(err);
                res.status(500).send('Internal Server Error!!!')
            }
            connection.query(category_item, [category, (page * 9) - 9, 9], (err, c_results, fields) => {
                if (err) {
                    console.log(err);
                    res.status(500).send('Internal Server Error!!!')
                }
                connection.query(item_count, category, (err, countse, fields) => {
                    if (err) {
                        console.log(err);
                        res.status(500).send('Internal Server Error!!!')
                    }
                    res.render('main', { h_article: h_results, c_article: c_results, category: category, cont: parseInt(countse[0].num) / 10 });

                });
            });
        });
    }
})

app.get('/login', (req, res) => {
    const sess = req.session;
    res.render('login', { pass: true });
})


app.post('/login', (req, res) => {
    const sess = req.session;
    let values = [req.body.username, req.body.password];
    let login_query = `
    select *
    from users
    where id=? and password=?;
    `;
    connection.query(login_query, values, (err, results) => {
        if (err) {
            console.log(err);
            res.status(500).send('Internal Server Error!!!')
        }

        if (results.length == 1) {
            sess.userid = results[0].id;
            sess.name = results[0].name;
            sess.grade = results[0].grade;
            req.session.save(() => {
                res.redirect('/');
            });
        } else {
            res.render('login', { pass: false });
        }
    })
})

app.get('/logout', (req, res) => {
    const sess = req.session;
    sess.destroy();
    res.redirect('/');
});

app.get('/item_add', (req, res) => {
    res.render('item_add')
    let seller_id = req.session.userid;
})

app.get('/item_add_content', (req, res) => {
    res.render('item_add_content')
})

app.post('/item_add_content', (req, res) => {
    let seller_id = req.session.userid;
    let values = [seller_id, req.body.category, req.body.title, req.body.content, req.body.min_price, req.body.max_price];
    let item_insert = `
        insert into item (seller_id, category, title, content, min_price, max_price, start_time, end_time)
        values (?, ?, ?, ?, ?, ?, now(), DATE_ADD(NOW(), INTERVAL 7 DAY))
    `;
    console.log(values);

    connection.query(item_insert, values, (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send('Internal Server Error!!!');
        }
        console.log('result : ', result);
        res.redirect('/item_info/' + result.insertId);
    });
});

app.get('/item_info/:num', (req, res) => {
        
    const num = req.params.num
    const nsp = io.of('/'+num)
    nsp.on('connection', (socket) => {
        console.log('a user connected');
        socket.on('chat message', (msg) => {
            let ipchal_update = `
            update item
            set price = ?
            where id = ?
            and price < ?
        `;
        
        connection.query(ipchal_update, [msg, num, msg], (err, result) => {
            if (err) {
                console.log(err);
            }        
            
            if(result.changedRows == 1) {
                nsp.emit('chat message', msg);
            }
        })
        });
        socket.on('disconnect', () => {
        console.log('user disconnected');
        });
    });
    
    let item_select = `
        select i.id, format(price, 0) price, time_to_sec(timediff(i.end_time, now())) time, i.title, i.content, i.seller_id, u.tel1, u.tel2, u.tel3
        from item i, users u
        where i.id = ?
        and u.id = i.seller_id
    `;
    connection.query(item_select, [num], (err, results, fields) => {
        if (err) {
            console.log(err);
            res.status(500).send('Internal Server Error!!!');
        }
        console.log(results[0]);
        
        res.render('item_info', { article: results[0]});
    });
});


app.get('/signup', (req, res) => {
    res.render('signup');
});

app.post('/signup', (req, res) => {
    const sess = req.session;

    let id = req.body.id;
    let name = req.body.name;
    let password = req.body.pass;
    let emailid = req.body.emailid;
    let emaildomain = req.body.emaildomain;
    let tel1 = req.body.tel1;
    let tel2 = req.body.tel2;
    let tel3 = req.body.tel3;
    let address = req.body.address;

    let values = [id, password, "G", name, emailid, emaildomain, tel1, tel2, tel3, address];
    let users_insert = `
    insert into users (id, password, grade, name, emailid, emaildomain, tel1, tel2, tel3, address)
    values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    connection.query(users_insert, values, (err, result) => {
        sess.userid = id;
        sess.name = name;
        sess.grade = "G";
        req.session.save(() => {
            res.redirect('/');
        });
    });
});


app.get('/signup', (req, res) => {
    res.render('signup');
});

app.post('/signup', (req, res) => {
    const sess = req.session;

    let id = req.body.id;
    let name = req.body.name;
    let password = req.body.pass;
    let emailid = req.body.emailid;
    let emaildomain = req.body.emaildomain;
    let tel1 = req.body.tel1;
    let tel2 = req.body.tel2;
    let tel3 = req.body.tel3;
    let address = req.body.address;

    let values = [id, password, "G", name, emailid, emaildomain, tel1, tel2, tel3, address];
    let users_insert = `
    insert into users (id, password, grade, name, emailid, emaildomain, tel1, tel2, tel3, address)
    values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    connection.query(users_insert, values, (err, result) => {
        sess.userid = id;
        sess.name = name;
        sess.grade = "G";
        req.session.save(() => {
            res.redirect('/');
        });
    });
});

app.get('/find_idpw', (req, res) => {
    res.render('find_idpw', { msg: "정확하게 입력하세요." });
});

app.post('/find_idpw', (req, res) => {
    const sess = req.session;

    let name = req.body.name;
    let emailid = req.body.emailid;
    let emaildomain = req.body.emaildomain;

    let values = [name, emailid, emaildomain];
    let find_idpw_query = `
    select *
    from users
    where name=? and emailid=? and emaildomain=?;
    `;
    connection.query(find_idpw_query, values, (err, results) => {
        if (err) {
            console.log(err);
            res.status(500).send('Internal Server Error!!!')
        }

        if (results.length == 1) {
            sess.userid = results[0].id;
            sess.name = results[0].name;
            sess.grade = results[0].grade;
            req.session.save(() => {
                res.redirect('/mypage');
            });
        } else {
            res.render('find_inpw', { msg: "등록된 계정이 없습니다." });
        }
    })
});

app.get('/mypage', (req, res) => {
    let userid = req.session.userid;
    let user_data_query = `
        select *
        from users
        where id = ?
    `;
    let item_data_query = `
        select *
        from item
        where seller_id = ?
    `;

    connection.query(user_data_query, [userid], (err, results, fields) => {
        if (err) {
            console.log(err);
            res.status(500).send('Internal Server Error!!!')
        }
        connection.query(item_data_query, [userid], (err, itemresults, fields) => {
            if (err) {
                console.log(err);
                res.status(500).send('Internal Server Error!!!')
            }
            console.log(itemresults);
            res.render('mypage', { article: results[0], itresult: itemresults });
        });
    });
});

app.post('/mypage', (req, res) => {
    const sess = req.session;

    let id = sess.userid;
    let name = req.body.name;
    let password = req.body.pass;
    let emailid = req.body.emailid;
    let emaildomain = req.body.emaildomain;
    let tel1 = req.body.tel1;
    let tel2 = req.body.tel2;
    let tel3 = req.body.tel3;
    let address = req.body.address;

    console.log(req.body);
    let values = [password, name, emailid, emaildomain, tel1, tel2, tel3, address, id];
    let users_update = `
    update users set
    password=?, name=?, emailid=?, emaildomain=?, 
    tel1=?, tel2=?, tel3=?, address=?
    where id=?
    `;
    connection.query(users_update, values, (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send('Internal Server Error!!!')
        }
        sess.userid = id;
        sess.name = name;
        sess.grade = "G";
        req.session.save(() => {
            res.redirect('/');
        });
    });
});

http.listen(8888, () => {
    console.log('8888 port opened!!!');
})