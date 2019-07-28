
//  Dependencies
var express = require('express');
var router = express.Router();
var path = require('path');


//  Cheerio and Request to scrape
var cheerio = require('cheerio');
var request = require('request');


//  Models
var Comment = require('../models/Comment.js');
var Article = require('../models/Article.js');

//  Index
router.get('/', function(req, res) {
  res.redirect('/articles');
});


//  GET request to scrape the Verge website
router.get('/scrape', function(req, res) {

  //  Request to grab HTML
  request('http://www.theverge.com/tech/', function(error, response, html) {

    //  Load into Cheerio & save as shorthand selector
    var $ = cheerio.load(html);
    var titlesArray = [];

    //  Grab the articles
    $('.c-entry-box--compact__title').each(function(i, element) {
      var result = {};

      //  Save the text and href of each link as properties of the result object
      result.title = $(this).children('a').text();
      result.link = $(this).children('a').attr('href');

      //  Don't send empty title or links to mongoDB
      if (result.title !== "" && result.link !== "") {
        //  Check for duplicates
        if (titlesArray.indexOf(result.title) == -1) {

          //  Push the title to the array 
          titlesArray.push(result.title);

          //  Add article only if it's not there already
          Article.count({ title: result.title}, function (err, test) {

            //  If the test == 0 the entry is unique, so save it
            if (test == 0) {
              //  Create new object
              var entry = new Article (result);

              // Save entry to mongoDB
              entry.save(function(err, doc) {
                if (err)
                  { console.log(err); }
                else
                  { console.log(doc); }
              });  //  entry.save
            }  //  if (test == 0)
          });  //  Article.count
        } else  //  if (titlesArray ...
          { console.log('Duplicate article') }

      } else
        { console.log('Not saved to DB, missing data') }

    });  //  Grab the articles

    // after scrape, redirects to index
    res.redirect('/');

  });  //  Request
});  //  Router


//  Get the articles and populate the DOM
router.get('/articles', function(req, res) {
  //  Sort newer articles to the top
  Article.find().sort({_id: -1})
    //  Handlebars
    .exec(function(err, doc) {
      if(err) {
        console.log(err);
      } else {
        var artcl = {article: doc};
        res.render('index', artcl);
      }
  });
});


//  Get articles scraped from mongoDB in JSON
router.get('/articles-json', function(req, res) {
  Article.find({}, function(err, doc) {
    if (err) {
      console.log(err);
    } else {
      res.json(doc);
    }
  });
});


//  Clear all articles
router.get('/clearAll', function(req, res) {
  Article.remove({}, function(err, doc) {
    if (err) {
      console.log(err);
    } else {
      console.log('removed all articles');
    }
  });
  res.redirect('/articles-json');
});


router.get('/readArticle/:id', function(req, res) {
  var articleId = req.params.id;
  var hbsObj = {
    article: [],
    body: []
  };

  //  Find article with the id
  Article.findOne({ _id: articleId })
    .populate('comment')

    .exec(function(err, doc) {
      if(err) {
        console.log('Error: ' + err);
      } else {
        hbsObj.article = doc;

        //grab article from link
        var link = doc.link;
        request(link, function(error, response, html) {
          var $ = cheerio.load(html);

          $('.l-col__main').each(function(i, element) {
            //  Send article body and comments to article.handlbars through hbObj
            hbsObj.body = $(this).children('.c-entry-content').children('p').text();
            res.render('article', hbsObj);

            //  Don't return an empty hbsObj.body
            return false;
          });
        });  //  requeswt
      }  //  if/else
    });  //  .exec
  });  //  Article


  //  Post new comment
  router.post('/comment/:id', function(req, res) {
    var user = req.body.name;
    var content = req.body.comment;
    var articleId = req.params.id;

  //  Submitted form
  var commentObj = {
    name: user,
    body: content
  };

  //  Create a new comment
  var newComment = new Comment(commentObj);

  newComment.save(function(err, doc) {
    if (err) {
      console.log(err);
    } else {
      console.log(doc._id)
      console.log(articleId)
      Article.findOneAndUpdate({ "_id": req.params.id }, {$push: {'comment':doc._id}}, {new: true})

      //  Run it all
      .exec(function(err, doc) {
        if (err)
          { console.log(err); }
        else
          { res.redirect('/readArticle/' + articleId); }
      });
    }
  });  //  newComment

});  //  router

module.exports = router;
