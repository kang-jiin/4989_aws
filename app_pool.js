const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const multer = require('multer')
const session = require('express-session');

const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
var list_query_data = {
    category: "%",
    keyword: "%",
    page: 1
};

const uploadformat = require('./public/js/uploadformat');
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let upload_folder = uploadformat.dateFormat();
        let real_folder = './uploads/' + upload_folder;
        fs.access(real_folder, fs.constants.F_OK | fs.constants.R_OK | fs.constants.W_OK, (err) => {
            if (err) {
                if (err.code = 'ENOENT') {
                    fs.mkdir(real_folder, (err) => {
                        if (err) {
                            throw err;
                        }
                        cb(null, real_folder);
                    });
                }
            } else {
                cb(null, real_folder);
            }
        });
    },
    filename: function (req, file, cb) {
        let oname = file.originalname;
        let idx = oname.lastIndexOf('.');
        cb(null, oname.substring(0, idx) + uploadformat.timeFormat() + oname.substring(idx));
    }
});

var upload = multer({ storage: storage });

app.locals.pretty = true;
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static('public'));
app.use(['/item_info', '/'], express.static('uploads'));

app.use(session({
    secret: '@#@$MYSIGN#@$#$',
    resave: false,
    saveUninitialized: true
}));

app.use(function (req, res, next) {
    res.locals.user = req.session;
    res.locals.data = list_query_data;
    next();
});

app.set('views', './views');
app.set('view engine', 'ejs');

//-----------DB------------------
var db_config  = require('./db-config.json');
const pool = mysql.createPool({
    host: db_config.host,
    user: db_config.user,
    password: db_config.password,
    database: db_config.database,
    port: 3306,
    connectionLimit: 20,
    waitForConnection: false
});
//-----------DB------------------

http.listen(8888, () => {
    console.log('8888 port opened!!!');
})

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

app.get('/', (req, res) => {
    let category, key, page;

    if (req.query.category != undefined) { // 쿼리에 카테고리가 있으면
        category = req.query.category;
        list_query_data.category = category;
    }
    else {
        list_query_data.category = "%";
        category = list_query_data.category;
    }

    if (req.query.keyword != undefined && req.query.keyword != "%") { // 쿼리에 키워드가 있으면
        key = "%" + req.query.keyword + "%";
    }
    else {
        list_query_data.keyword = "%";
        key = list_query_data.keyword;
    }

    if (req.query.page != undefined) page = req.query.page;
    else page = 1;

    let hot_item = `
        select i.id, i.hit, format(i.price, 0) price, DATE_FORMAT(i.end_time, "%Y-%m-%d %H:%i:%s ") time, i.title,
        g.savefolder, g.savename
        from item i
        left outer join img g on i.id = g.item_id
        order by hit desc
        limit 0,3;
    `;
    let category_item = `
        select i.id, i.category, i.hit, format(i.price, 0) price, DATE_FORMAT(i.end_time, "%Y-%m-%d %H:%i:%s ") time, i.title,
        g.savefolder, g.savename
        from item i
        left outer join img g on i.id = g.item_id
        where title like ? and category like ?
        order by id desc
        LIMIT ?, ?
    `;
    let item_count = `
        select count(*) as num
        from item
        where title like ? and category like ?
    `;

    pool.getConnection((err, connection) => {
        connection.query(hot_item, (err, h_results, fields) => {
            if (err) {
                console.log(err);
                connection.release();
                res.status(500).send('Internal Server Error!!!')
            }
            connection.query(category_item, [key, category, (page * 9) - 9, 9], (err, c_results, fields) => {
                if (err) {
                    console.log(err);
                    connection.release();
                    res.status(500).send('Internal Server Error!!!')
                }
                connection.query(item_count, [key, category], (err, countse, fields) => {
                    if (err) {
                        console.log(err);
                        connection.release();
                        res.status(500).send('Internal Server Error!!!')
                    }
                    connection.release();
                    res.render('main', { h_article: h_results, c_article: c_results, category: 'main', cont: parseInt(countse[0].num) / 10 });
                });
            });
        });
    });
})

app.post('/', (req, res) => { // 검색버튼 클릭
    let keyword = req.body.keyword;
    let category = list_query_data.category;

    if (keyword == '') keyword = "%";
    list_query_data.keyword = keyword;
    res.redirect('/' + '?category=' + category + '&keyword=' + keyword + '&page=1');
});

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
    pool.getConnection((err, connection) => {
        connection.query(login_query, values, (err, results) => {
            if (err) {
                console.log(err);
                connection.release();
                res.status(500).send('Internal Server Error!!!')
            }

            if (results.length == 1) {
                sess.userid = results[0].id;
                sess.name = results[0].name;
                sess.grade = results[0].grade;
                req.session.save(() => {
                    connection.release();
                    res.redirect('/');
                });
            } else {
                connection.release();
                res.render('login', { pass: false });
            }
        })
    });
})

app.get('/guestlogin', (req, res) => {
    const sess = req.session;
    sess.userid = 'honggd';
    sess.name = '홍길동';
    sess.grade = 'G';
    req.session.save(() => {
        res.redirect('/');
    });
})

app.get('/logout', (req, res) => {
    const sess = req.session;
    sess.destroy();
    res.redirect('/');
});

app.get('/item_add', (req, res) => {
    res.render('item_add');
});

app.get('/item_add_content', (req, res) => {
    res.render('item_add_content');
});

app.post('/item_add_content', upload.single('img'), (req, res) => {
    let seller_id = req.session.userid;
    let min_price = req.body.min_price.replace(/,/gi, '');
    let max_price = req.body.max_price.replace(/,/gi, '');

    let values = [seller_id, req.body.category, req.body.title, req.body.content, min_price, max_price, min_price];
    let item_insert = `
        insert into item (seller_id, category, title, content, min_price, max_price, start_time, end_time, price)
        values (?, ?, ?, ?, ?, ?, now(), DATE_ADD(NOW(), INTERVAL 7 DAY), ?)
    `;
    let img_insert = `
        insert into img (savefolder, originalname, savename, item_id)
        values (?, ?, ?, ?)
    `;

    pool.getConnection((err, connection) => {
        connection.beginTransaction((err) => {
            connection.query(item_insert, values, (err, result) => {
                if (err) {
                    console.log(err);
                    connection.release();
                    res.status(500).send('Internal Server Error!!!');
                }
                let pageId = result.insertId;
                let upload_folder = uploadformat.dateFormat();
                let values2 = [upload_folder, req.file.originalname, req.file.filename, result.insertId];

                connection.query(img_insert, values2, (err, result) => {
                    if (err) {
                        connection.rollback(() => {
                            console.log(err);
                            connection.release();
                            res.status(500).send('Internal Server Error!!!');
                        })
                    }
                    connection.commit((err) => {
                        if (err) {
                            connection.rollback(() => {
                                console.log(err);
                                connection.release();
                                res.status(500).send('Internal Server Error!!!');
                            })
                        }
                        console.log('result : ', result);
                        connection.release();
                        res.redirect('/item_info/' + pageId);
                    });
                });
            });
        });
    });
});

app.get('/item_modify', (req, res) => {
    let num = req.query.num;

    let item_select = `
        select * 
        from item
        where id = ?
    `;

    pool.getConnection((err, connection) => {
        connection.query(item_select, num, (err, result) => {
            if (err) {
                console.log(err);
                connection.release();
                res.status(500).send('Internal Server Error!!!');
            }
            console.log(result);
            res.render('item_modify', { article: result[0] });
        });
    });
});

app.get('/item_modify_content', (req, res) => {
    res.render('item_modify_content');
});

app.post('/item_modify_content', (req, res) => {
    let content = req.body.content;
    let id = req.body.id;

    console.log(content);
    console.log(id);

    let item_update = `
        update item
        set content = ?
        where id = ?
    `;

    let values = [content, id];

    pool.getConnection((err, connection) => {
        connection.query(item_update, values, (err, result) => {
            if (err) {
                console.log(err);
                connection.release();
                res.status(500).send('Internal Server Error!!!');
            }
            connection.commit((err) => {
                if (err) {
                    connection.rollback(() => {
                        console.log(err);
                        connection.release();
                        res.status(500).send('Internal Server Error!!!');
                    })
                }
                console.log('result : ', result);
                connection.release();
                res.redirect('/item_info/' + id);
            });
        });
    });
});

app.get('/item_delete', (req, res) => {
    var num = req.query.num;

    let img_data = `
        select *
        from img
        where item_id = ?
    `;

    let item_delete = `
        delete from item
        where id = ?
    `;

    pool.getConnection((err, connection) => {
        connection.query(img_data, num, (err, result) => {
            if (err) {
                console.log(err);
                connection.release();
                res.status(500).send('Internal Server Error!!!');
            }
            connection.query(item_delete, num, (err) => {
                if (err) {
                    console.log(err);
                    connection.release();
                    res.status(500).send('Internal Server Error!!!');
                }
                if (result[0].savefolder) {
                    fs.unlink('./uploads/' + result[0].savefolder + '/' + result[0].savename, (err) => {
                        if (err) {
                            console.log(err);
                            conn.release();
                            throw err;
                        }
                    });
                }
                res.redirect('/');
            });
        });
    });
});

app.get('/item_info/:num', (req, res) => {
    const num = req.params.num
    const loginid = req.session.userid;

    let hit_update = `
        update item
        set hit= hit+1
        where id=?
    `;
    let item_select = `
        select i.id, i.category, format(i.price, 0) price, format(i.max_price, 0) max_price,
            time_to_sec(timediff(i.end_time, now())) time, i.bidder_id,
            i.title, i.content, i.seller_id, u.tel1, u.tel2, u.tel3,
            if(i.end_time > now(), 'true', 'false') flag,
            g.item_id, g.savefolder, g.originalname, g.savename
        from users u join item i
        on u.id = i.seller_id
        left outer join img g
        on i.id = g.item_id
        where i.id = ?
    `;
    let same_category = `
        select i.id, i.title, g.savefolder, g.savename
        from item i
        left outer join img g
        on i.id = g.item_id
        where category = ?
        and i.id != ?
        order by i.id desc
        limit 0, 6
    `;
    let bid_list = `
        select b.id id, format(b.price, 0) price, date_format(b.time, '%Y-%m-%d %H:%i:%s') time, u.id bidder
        from bid b, users u
        where b.bidder_id = u.id
        and b.item_id = ?
        order by time desc
        LIMIT 0,10;
    `
    let comment_list = `
        select c.id id, c.item_id item_id, c.writer_id writer, c.content content,  date_format(c.time, '%Y-%m-%d %H:%i:%s') time
        from comments c, users u
        where c.writer_id = u.id
        and c.item_id = ?
        order by time desc;
    `

    pool.getConnection((err, connection) => {
        connection.beginTransaction((err) => {
            connection.query(hit_update, [num], (err) => {
                if (err) {
                    console.log(err);
                    connection.release();
                    res.status(500).send('Internal Server Error!!!');
                }
                connection.query(comment_list, [num], (err, comment_lists, fields) => {
                    if (err) {
                        console.log(err);
                        connection.release();
                        res.status(500).send('Internal Server Error!!!');
                    }
                    connection.query(bid_list, [num], (err, bid_lists, fields) => {
                        if (err) {
                            console.log(err);
                            connection.release();
                            res.status(500).send('Internal Server Error!!!');
                        }
                        connection.query(item_select, [num], (err, results, fields) => {
                            if (err) {
                                console.log(err);
                                connection.release();
                                res.status(500).send('Internal Server Error!!!');
                            }
                            connection.query(same_category, [results[0].category, results[0].id], (err, category_results, fields) => {
                                if (err) {
                                    connection.rollback(() => {
                                        console.log(err);
                                        connection.release();
                                        res.status(500).send('Internal Server Error!!!');
                                    })
                                }
                                connection.commit((err) => {
                                    if (err) {
                                        connection.rollback(() => {
                                            console.log(err);
                                            connection.release();
                                            res.status(500).send('Internal Server Error!!!');
                                        })
                                    }
                                    connection.release();
                                    res.render('item_info', { article: results[0], loginid: loginid, category_results: category_results, bid_lists: bid_lists, comment_lists: comment_lists });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

app.post('/comment/add', (req, res) => {
    const sess = req.session;
    let num = req.query.num;
    let comment = req.body.comment;

    let values = [num, sess.userid, comment];
    let comments_insert = `
        insert into comments
        (item_id, writer_id, content, time)
        values (?, ?, ?, now())
    `;
    pool.getConnection((err, connection) => {
        connection.query(comments_insert, values, (err) => {
            if (err) {
                console.log(err);
                connection.release();
                res.status(500).send('Internal Server Error!!!');
            }            
            res.redirect('/item_info/'+ num);
            connection.release();
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
    let zip_code = req.body.addr1;
    let address = req.body.addr2;
    let address_detail = req.body.addr3;

    let values = [id, password, "G", name, emailid, emaildomain, tel1, tel2, tel3, zip_code, address, address_detail];
    let users_insert = `
    insert into users (id, password, grade, name, emailid, emaildomain, tel1, tel2, tel3, zip_code, address, address_detail)
    values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    pool.getConnection((err, connection) => {
        connection.query(users_insert, values, (err, result) => {
            sess.userid = id;
            sess.name = name;
            sess.grade = "G";
            req.session.save(() => {
                res.redirect('/');
            });
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
    pool.getConnection((err, connection) => {
        connection.query(find_idpw_query, values, (err, results) => {
            if (err) {
                console.log(err);
                connection.release();
                res.status(500).send('Internal Server Error!!!')
            }

            if (results.length == 1) {
                sess.userid = results[0].id;
                sess.name = results[0].name;
                sess.grade = results[0].grade;
                req.session.save(() => {
                    connection.release();
                    res.redirect('/mypage');
                });
            } else {
                connection.release();
                res.render('find_idpw', { msg: "등록된 계정이 없습니다." });
            }
        })
    });
});

app.get('/mypage', (req, res) => {
    let userid = req.session.userid;
    let user_data_query = `
        select *
        from users
        where id = ?
    `;
    let item_data_query = `
        select item.title title, item.id id, img.savefolder savefolder, img.savename savename
        from item, img
        where item.id = img.item_id
        and item.seller_id = ?
    `;
    let cham_data_query =`
        select item.title tit, item.id itid, img.savefolder savefolder, img.savename savename
        from bid, item, img
        where bid.item_id = item.id
        and item.id = img.item_id
        and bid.bidder_id = ?;
    `
    pool.getConnection((err, connection) => {
        connection.query(user_data_query, [userid], (err, results, fields) => {
            if (err) {
                console.log(err);
                connection.release();
                res.status(500).send('Internal Server Error!!!')
            }
            connection.query(item_data_query, [userid], (err, itemresults, fields) => {
                if (err) {
                    console.log(err);
                    connection.release();
                    res.status(500).send('Internal Server Error!!!')
                }
                connection.query(cham_data_query, [userid], (err, kint, fields) => {
                if (err) {
                    console.log(err);
                    connection.release();
                    res.status(500).send('Internal Server Error!!!')
                }
                connection.release();
                res.render('mypage', { article: results[0], itresult: itemresults, itemresult: kint });
            });
            });
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
    let zip_code = req.body.addr1;
    let address = req.body.addr2;
    let address_detail = req.body.addr3;

    console.log(req.body);
    let values = [password, name, emailid, emaildomain, tel1, tel2, tel3, zip_code, address, address_detail, id];
    let users_update = `
    update users set
    password=?, name=?, emailid=?, emaildomain=?, 
    tel1=?, tel2=?, tel3=?, zip_code=?, address=?, address_detail=?
    where id=?
    `;
    pool.getConnection((err, connection) => {
        connection.query(users_update, values, (err, result) => {
            if (err) {
                console.log(err);
                connection.release();
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
});

const nsp = io.of('/nsp')
nsp.on('connection', (socket) => {
    let num;
    let id;
    console.log('a user connected');
    socket.on('joinRoom', (param, loginid) => {
        num = param;
        id = loginid;
        socket.join(num, () => {
            io.to(num);
        });
    });
    socket.on('chat message', (msg) => {
        let ipchal_update = `
            update item
            set price = ?, bidder_id = ?
            where id = ?
            and price < ?
            and max_price >= ?
            and seller_id != ?
            and end_time > now()
        `;
        let bid_insert = `
            insert into bid (item_id, bidder_id, price, time)
            values (?, ?, ?, now())
        `;
        pool.getConnection((err, connection) => {
            connection.beginTransaction((err) => {
                if (err) {
                    connection.release();
                    throw err;
                }
                connection.query(ipchal_update, [msg, id, num, msg, msg, id], (err, up_result) => {
                    if (err) {
                        connection.release();
                        console.log(err);
                        throw err;
                    }
                    if (up_result.changedRows == 1) {
                        connection.query(bid_insert, [num, id, msg], (err, in_result) => {
                            if (err) {
                                connection.rollback(() => {
                                    console.log(err);
                                    connection.release();
                                    throw err;
                                })
                            }
                            connection.commit((err) => {
                                if (err) {
                                    connection.rollback(() => {
                                        console.log(err);
                                        connection.release();
                                        throw err;
                                    })
                                }
                                connection.release();
                                nsp.to(num).emit('chat message', {msg: numberWithCommas(msg), id: id});
                            });
                        });
                    }
                });
            });
        });
    });
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});