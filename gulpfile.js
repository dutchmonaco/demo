const fs = require('fs');
var gulp = require('gulp');
var sass = require('gulp-sass');

var Prismic = require('prismic.io');



var env = new Object();
env.dev = { id: "dev", path: 'builds/dev', css: 'builds/dev/css', js: 'builds/dev/js'};
env.prod = { id: "prod", path: 'builds/prod', css: 'builds/prod/css', js: 'builds/prod/js' };

env.current = env.dev;

/* TINY PNG */
gulp.task('build', function () {
  
  Prismic.api("https://dmcms.prismic.io/api").then(function(api) {
    return api.query(Prismic.Predicates.at('document.type', 'product'));
  }).then(function(response) {
  var buffer = [];
  var data = response.results;
  for(var i=0;i<data.length;i++){
	var post_title = data[i].data["product.title"].value[0].text;
	var post_desc = data[i].data["product.description"].value[0].text;
    
	if( data[i].data["product.image"]){
	  post_image = data[i].data["product.image"].value.main.url;
	}
	var content = { title: post_title, desc: post_desc, image: post_image };
	buffer.push(content);
  }
  fs.writeFile('_json/products.json', JSON.stringify(buffer));
}, function(err) {
  console.log("Something went wrong: ", err);
});


    gulp.src('html/sass/**/*.scss')
        .pipe(sass().on('error', sass.logError))
        .pipe(gulp.dest('dist/css/'));
		
		
		gulp.src('html/**/*.html').pipe(gulp.dest('dist/'));
  
  
});

/* BROWSER SYNC */
gulp.task('browserSync', function() { browserSync.init({ server: { baseDir: 'builds/dev/' }, }) });


gulp.task('watch',['browserSync'], function () {
  gulp.watch(['html/**/*'], ['make']).on('change', browserSync.reload);
  
});

gulp.task("upload", function() {
  gulp.src('assets/**/*').pipe(s3({Bucket: 'yakuzagame', ACL: 'public-read',keyTransform: function(relative_filename){ return "assets/"+relative_filename;} }, { maxRetries: 5 }));
});

gulp.task("upload-min", function() {
  gulp.src('builds/assets/**/*').pipe(s3({Bucket: 'yakuzagame', ACL: 'public-read',keyTransform: function(relative_filename){ return "assets/"+relative_filename;} }, { maxRetries: 5 }));
});

gulp.task('invalidate', function () {
  var settings = { distribution: 'E27QSG0SV6GYEC',paths: ['/yakuzagame/assets/'], accessKeyId: 'AKIAI55YXJGCW77A7FHQ', secretAccessKey: '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', sessionToken: null, wait: true };
  return gulp.src('*').pipe(cloudfront(settings));
});



/* GULP COMPILE TEMPLATES */

gulp.task('make',['minify','make-comic'], function () {
  var data = new Object();
  data.settings = JSON.parse(fs.readFileSync('contentful/settings.json'));
  data.global = JSON.parse(fs.readFileSync('contentful/global.json'));
  data.games = JSON.parse(fs.readFileSync('contentful/game.json'));
  data.comics = JSON.parse(fs.readFileSync('contentful/comic.json'));
  data.morexp = JSON.parse(fs.readFileSync('contentful/morexp.json'));
 
  var templateData = { 
  	global: data.global[0],
	head_comic: data.global[1],
	games: data.games,
	settings: data.settings[0],
	morexp : data.morexp,
	comics: data.comics,
	cdn: data.global.assetUrl,
	ga: data.global.googleAnalytics
  }
  
  
  if(env.current.id=="dev"){ 
    templateData.global.googleAnalytics = "UA-55821664-13";
	templateData.head_comic.googleAnalytics = "UA-55821664-13";
  }
  
  var options = { 
  	batch : ['./html/template/partials'],
	helpers : {
		isVideo : function(str){ if(str=="videos"){ return true } else { return false; }  },
		isSlugEmpty : function(slug){ if(slug!==undefined){ return "active" } else { return ""; }  },
		isActiveComic : function(slug){ if(slug!==undefined){ return slug+"-1"; } else { return "javascript:void(0)"; }  },
		toJSON : function (obj){ return new handlebars.Handlebars.SafeString(JSON.stringify(obj)); },
		trim : function (str){ return str.replace(/\s/g,''); },
		isNull : function (str){ if(str=="" || str==null){ return true; }else{ return false; } }
	}
  }
    gulp.src('html/template/pages/**/*.hbs').
	pipe(handlebars(templateData, options)).
	pipe(rename({extname: '.html' })).
	pipe(gulp.dest(env.dev.path)).
	pipe(gulp.dest(env.prod.path));
	gulp.src(['public/.htaccess']).pipe(gulp.dest('builds/dev/'));
	return 1;
});

gulp.task('make-comic', function() {
  var comics = JSON.parse(fs.readFileSync('contentful/comic.json'));
  var data = new Object();
  
  data.global = JSON.parse(fs.readFileSync('contentful/global.json'));
  data.morexp = JSON.parse(fs.readFileSync('contentful/morexp.json'));
  data.settings = JSON.parse(fs.readFileSync('contentful/settings.json'));
  
   var options = { 
  	batch : ['./html/template/partials'],
	helpers : {
		isVideo : function(str){ if(str=="videos"){ return true } else { return false; }  },
		isSlugEmpty : function(slug){ if(slug!==undefined){ return "active" } else { return ""; }  },
		isActiveComic : function(slug){ if(slug!==undefined){ return slug+"-1"; } else { return "javascript:void(0)"; }  },
		toJSON : function (obj){ return new handlebars.Handlebars.SafeString(JSON.stringify(obj)); },
		isNull : function (str){ if(str=="" || str==null){ return true; }else{ return false; } }
	}
  }
  for(var i=0; i<comics.length;i++){
	if(comics[i].slug!==undefined){
	  /* Override Metas */
	  
	  
	  data.global[1].ogtitle = comics[i].title;
	  data.global[1].ogdescription = comics[i].facebookShare;
	  data.global[1].ogimage = comics[i].facebookShareImage;
	  
	  data.global[1].metaDescription = comics[i].episodeDescription;
	  data.global[1].twitterimage = comics[i].twitterShareImage;
	  data.global[1].twittertitle = comics[i].title;
	  for(var j=0;j<8;j++){
	    var fileName = "comic-"+comics[i].slug+"-"+(j+1);
		var prev = '';
		var index = (1+j);
		var pagination = {};
		var comic = new Object();
		if(j<1){ comic = { first: "1", second: "2", third: "3", fourth : "4" }; }
		if(j>=1){ comic = { first: "1", second: "2", third: "3", fourth : "4" }; }
		if(j==0){ pagination.prev = 'javascript:void(0)'; pagination.prevIndex = "";  }else{ pagination.prev = "comic-"+comics[i].slug+"-"+(index-1); pagination.prevIndex = index-1; }
	   if(j==7){ pagination.next = 'javascript:void(0)'; pagination.nextIndex = ""; }else{ pagination.next = "comic-"+comics[i].slug+"-"+(index+1); pagination.nextIndex = index+1;  }
		var content = { 
				comic: comic, 
				head_comic:  data.global[1], 
				global: data.global[1], 
				settings : data.settings[0], 
				pagination: pagination, 
				title : 'CHAPTER 1 <span class="dark-gray">-</span> '+comics[i].title, 
				morexp : data.morexp,
				page_idx : (j+1),
				url : comics[i].slug+"-"+(j+1)
		};
		
		if(env.current.id=="dev"){ 
		  content.global.googleAnalytics = "UA-55821664-13";
		  content.head_comic.googleAnalytics = "UA-55821664-13";
		}
		gulp.src('html/template/single/comic-detail.hbs').pipe(handlebars(content,options)).pipe(rename(fileName + ".html")).pipe(gulp.dest('builds/dev/')).pipe(gulp.dest('builds/prod/'));
	  }
	}
    
  }
  
});



/* COPY STATIC */
gulp.task('move-static', function() {
  gulp.src(['html/js/**/*']).pipe(gulp.dest('builds/dev/js/'));
  //gulp.src(['html/css/**/*']).pipe(gulp.dest('builds/dev/css/'));
  //gulp.src(['html/fonts/**/*']).pipe(gulp.dest('builds/dev/fonts/'));
  //gulp.src(['public/.htaccess']).pipe(gulp.dest('builds/dev/'));
  return 1;
});

/* JEAN */
gulp.task('jean', function() {
  //gulp.src(['jean/html/*.html']).pipe(gulp.dest('builds/dev/js/'));
  gulp.src(['jean/js/**/*']).pipe(gulp.dest('builds/dev/js/'));
  gulp.src(['jean/css/**/*']).pipe(gulp.dest('builds/dev/css/'));
  gulp.src(['jean/fonts/**/*']).pipe(gulp.dest('builds/dev/fonts/'));
  gulp.src(['jean/data/**/*']).pipe(gulp.dest('builds/dev/data/'));
});



/* MINIFY JS / CSS */
gulp.task('minify', function(){
  gulp.src(['html/js/jquery.touchwipe.1.1.1.js','html/js/yakuza.js','html/js/underscore-min.js']).pipe(concat('src.js')).pipe(uglify()).pipe(rename('app.min.js')).pipe(gulp.dest(env.current.js));
  gulp.src('html/css/*.css').pipe(cleanCSS()).pipe(rename({suffix: '.min'})).pipe(gulp.dest(env.current.css));
  return;
});





/* MINIFY IMAGES */

gulp.task("imagemin", function() {
 return gulp.src('assets/**/*').pipe(imagemin()).pipe(gulp.dest('builds/assets'));
});


/*RETRIEVE CONTENT FROM CONTENTFUL*/

gulp.task("contentful",function(){ 
  
  var client = contentful.createClient({ space: "zfky86x5hmfs", accessToken: "6865c46c002ea90d855e987919a2cd46f06d99723bed5ea8c61f749da5cb92e4" });  
  var timeline = [];
  var characters = [];
  var family = [];
  var game = [];
  var global = [];
  var year = [];
  var comic = [];
  var nodes = [];
  var morexp = [];
  var settings = [];
  /*
  client.getEntries().then(function(entries){
	entries.items.forEach(function(entry){
	var result = {};
	  result.title = entry.fields.title;
	  result.location = entry.fields.location;
	  result.description = entry.fields.description;
	  if(entry.fields.game!==undefined){ result.game = entry.fields.game[0].fields; }
      timeline.push(result);
    });
	fs.writeFile('timeline.json', JSON.stringify(timeline), (err) =>{ if (err) throw err; });
    console.log("Saved to timeline.json");
  });
  */
  
   /* C
      H
	  A
	  R
	  A
	  C
	  T
	  E
	  R
	  S */
   client.getEntries({ 'content_type': 'characters' }).then(function(entries){
	entries.items.forEach(function(entry){
		
	  var result = {};
	  var arrCollection;
	  var arrJson;
	  result.name = entry.fields.name;
	  result.biographicalData = entry.fields.biographicalData;
	  result.aliasesTitles = entry.fields.aliasesTitles;
	  
	  result.description = entry.fields.description;
	  result.descriptionY0 = entry.fields.descriptionY0;
	  result.descriptionYk = entry.fields.descriptionYk;
	  result.descriptionY2 = entry.fields.descriptionY2;
	  result.descriptionY3 = entry.fields.descriptionY3;
	  result.descriptionY4 = entry.fields.descriptionY4;
	  result.descriptionY5 = entry.fields.descriptionY5;
	  result.descriptionY6 = entry.fields.descriptionY6;
	  
	  result.bustShotFImage = entry.fields.bustShotFImage;
	  result.bustShotY0Image = entry.fields.bustShotY0Image;
	  result.bustShotYkImage = entry.fields.bustShotYkImage;
	  result.bustShotY2Image = entry.fields.bustShotY2Image;
	  result.bustShotY3Image = entry.fields.bustShotY3Image;
	  result.bustShotY4Image = entry.fields.bustShotY4Image;
	  result.bustShotY5Image = entry.fields.bustShotY5Image;
	  result.bustShotY6Image = entry.fields.bustShotY6Image;
	  result.fullSizeY0Image = entry.fields.fullSizeY0Image;
	  result.fullSizeYkImage = entry.fields.fullSizeYkImage;
	  result.fullSizeFImage = entry.fields.fullSizeFImage;
	  
	  
	  
	  	  
	  result.fullSizeY2Image = entry.fields.fullSizeY2Image;
	  result.fullSizeY3Image = entry.fields.fullSizeY3Image;
	  result.fullSizeY4Image = entry.fields.fullSizeY4Image;
	  result.fullSizeY5Image = entry.fields.fullSizeY5Image;
	  result.fullSizeY6Image = entry.fields.fullSizeY6Image;
	 
	  
	  result.fullSizeImage = entry.fields.fullSizeImage;
	  
	  result.video = entry.fields.video;
	  result.gallery= entry.fields.gallery;
	  result.inFamily = entry.fields.inFamily;
	  
	  result.inGame = [];
	  result.playable = entry.fields.playable;
	  result.playableInGame = [];
	  result.isHighlighted = [];
	  
	  // IN GAME COLLECTION
	  if(entry.fields.inGame!==undefined){ 
	    if(entry.fields.inGame.length===undefined){ 
		  result.inGame.push(entry.fields.inGame.fields.gameTitle); 
		}else{
		  for(var i=0;i<entry.fields.inGame.length;i++){ result.inGame.push(entry.fields.inGame[i].fields.gameTitle); }
		}
	  }
	  
	  //isHighlighted
	  if(entry.fields.isHighlighted!==undefined){ 
	    if(entry.fields.isHighlighted.length===undefined){ 
		  result.inGame.push(entry.fields.isHighlighted.fields.sequenceId); 
		}else{
		  for(var i=0;i<entry.fields.isHighlighted.length;i++){ result.isHighlighted.push(entry.fields.isHighlighted[i].fields.sequenceId); }
		}
	  }
	  
	  
	 
	  
	  // IN GAME COLLECTION
	  if(entry.fields.playableInGame!==undefined){ 
	    if(entry.fields.playableInGame.length===undefined){ 
		  result.inGame.push(entry.fields.playableInGame.fields.gameTitle); 
		}else{
		  for(var i=0;i<entry.fields.playableInGame.length;i++){ result.playableInGame.push(entry.fields.playableInGame[i].fields.gameTitle); }
		}
	  }
	  
      characters.push(result);
    });
	var data = JSON.stringify(characters);
	var filename = 'contentful/characters.json';
	fs.writeFile(filename, data, function (err){ if (err) return console.log(err); });
    console.log("Done! Saved to "+filename);
  });
  
  
  /* Y
     E
	 A
	 R */
	 
  client.getEntries({ 'content_type': 'year' }).then(function(entries){
	entries.items.forEach(function(entry){
	var result = {};
	  result.yearId = entry.fields.yearId;
      year.push(result);
    });
	var data = JSON.stringify(year);
	var filename = 'contentful/year.json';
	fs.writeFile(filename, data, function (err){ if (err) return console.log(err); });
    console.log("Done! Saved to "+filename);
  });
  
  /* M
     O
	 R
	 E
	 E
	 X
	 P */
	 
  client.getEntries({ 'content_type': 'moreExperiences' }).then(function(entries){
	entries.items.forEach(function(entry){
	var result = {};
	  result.name = entry.fields.name;
	  result.thumbnail = entry.fields.thumbnail;
	  result.description = entry.fields.description;
	  result.link = entry.fields.link;
	  result.order = entry.fields.order;
      morexp.push(result);
    });
	var data = JSON.stringify(_.sortBy(morexp, 'order'));
	var filename = 'contentful/morexp.json';
	fs.writeFile(filename, data, function (err){ if (err) return console.log(err); });
    console.log("Done! Saved to "+filename);
  });
  
  


  


  /* G
  	 L
	 O
	 B
	 A
	 L */
  
  client.getEntries({ 'content_type': 'global' }).then(function(entries){
	entries.items.forEach(function(entry){
	var result = {};
      result.titleTag = entry.fields.titleTag;
	  result.favico = entry.fields.favico;
	  result.facebookShare = entry.fields.facebookShare;
	  result.facebookShareImage = entry.fields.facebookShareImage;
	  result.twitterShare = entry.fields.twitterShare;
	  result.twitterShareImage = entry.fields.twitterShareImage;
	  result.legal = entry.fields.legal;
	  result.googleAnalytics = entry.fields.googleAnalytics;
	  result.schemaOrg = entry.fields.schemaOrg;
	  result.assetUrl = entry.fields.assetUrl;
	  
	  result.oglocale = entry.fields.oglocale;
	  result.ogtype = entry.fields.ogtype;
	  result.ogtitle = entry.fields.ogtitle;
	  result.ogdescription = entry.fields.ogdescription;
	  result.ogsiteName = entry.fields.ogsiteName;
	  result.ogimage = entry.fields.ogimage;
	  result.ogimagewidth = entry.fields.ogimagewidth;
	  result.ogimageheight = entry.fields.ogimageheight;
	  
	  result.twittercard = entry.fields.twittercard;
	  result.twittersite = entry.fields.twittersite;
	  result.twittertitle = entry.fields.twittertitle;
	  result.twitterdescription = entry.fields.twitterdescription;
	  result.twitterurl = entry.fields.twitterurl;
	  result.twitterimage = entry.fields.twitterimage;
	  
	  result.appleTouchIcon57 = entry.fields.appleTouchIcon57;
	  result.appleTouchIcon72 = entry.fields.appleTouchIcon72;
	  result.appleTouchIcon114 = entry.fields.appleTouchIcon114;
	  result.appleTouchIcon120 = entry.fields.appleTouchIcon120;
	  result.appleTouchIcon144 = entry.fields.appleTouchIcon144;
	  
	  result.metaDescription = entry.fields.metaDescription;
	  result.metaKeywords = entry.fields.metaKeywords;
	  result.sequenceId = entry.fields.sequenceId;
	  global.push(result);
    });
	var data = JSON.stringify(_.sortBy(global, 'sequenceId'));
	var filename = 'contentful/global.json';
	fs.writeFile(filename, data, function (err){ if (err) return console.log(err); });
    console.log("Done! Saved to "+filename);
  });  
  
  /* C
     O
	 M
	 I
	 C */
  
  client.getEntries({ 'content_type': 'comic' }).then(function(entries){
	entries.items.forEach(function(entry){
	var result = {};
	  result.episodeNumber = entry.fields.episodeNumber;
	  result.title = entry.fields.title;
	  result.subTitle = entry.fields.subTitle;
	  result.slug = entry.fields.slug;
	  result.episodeDescription = entry.fields.episodeDescription;
	  result.coverImage = entry.fields.coverImage;
	  result.facebookShare = entry.fields.facebookShare;
	  result.facebookShareImage = entry.fields.facebookShareImage;
	  result.twitterShare = entry.fields.twitterShare;
	  result.twitterShareImage = entry.fields.twitterShareImage;
      comic.push(result);
    });
	var data = JSON.stringify(_.sortBy(comic, 'episodeNumber'));
	var filename = 'contentful/comic.json';
	fs.writeFile(filename, data, function (err){ if (err) return console.log(err); });
    console.log("Done! Saved to "+filename);
  });
  
  
  /* F
     A
	 M
	 I
	 L
	 Y */
  client.getEntries({ 'content_type': 'family',include:5,limit:500 }).then(function(entries){
	entries.items.forEach(function(entry){
	  var result = {};
	  result.updatedAt = entry.sys.updatedAt;
	  result.name = entry.fields.name;
	  result.yearId = [];
	  
	   // YEAR ID
	  if(entry.fields.yearId!==undefined){ 	
	    if(entry.fields.yearId.length===undefined){  
		  result.yearId.push(entry.fields.yearId.fields.yearId);
		}else{
		  for(var i=0;i<entry.fields.yearId.length;i++){ result.yearId.push(entry.fields.yearId[i].fields.yearId); }
		}
	  }
	  
	  result.game = [];
	  if(entry.fields.game!==undefined){ 
	    if(entry.fields.game.length===undefined){ 
		  result.game.push(entry.fields.game.fields.gameTitle); 
		}else{
		  for(var i=0;i<entry.fields.game.length;i++){ result.game.push(entry.fields.game[i].fields.gameTitle); }
		}
	  }
	  result.firstOrSecondHalf = entry.fields.firstOrSecondHalf;
	  result.composition = entry.fields.composition;
	  result.crest = entry.fields.crest;
	  result.biographicalData = entry.fields.biographicalData;
	  
      result.characters = [];
	  if(entry.fields.characters!==undefined){ 
	    if(entry.fields.characters.length===undefined){ 
		  result.characters.push(entry.fields.characters.fields.name); 
		}else{
	      for(var i=0;i<entry.fields.characters.length;i++){  result.characters.push(entry.fields.characters[i].fields.name); } 
		}
	  }	 
      result.otherRelatedFamilies = [];
	  if(entry.fields.otherRelatedFamilies!==undefined){ 
	    if(entry.fields.otherRelatedFamilies.length===undefined){ 
		  result.otherRelatedFamilies.push(entry.fields.otherRelatedFamilies.fields.name);
		}else{
	      for(var i=0;i<entry.fields.otherRelatedFamilies.length;i++){ result.otherRelatedFamilies.push(entry.fields.otherRelatedFamilies[i].fields.name); } 
		}
	  }	 
	  result.timelineEvent = [];
	  if(entry.fields.timelineEvent!==undefined){ 
	    if(entry.fields.timelineEvent.length===undefined){ 
		  result.timelineEvent.push(entry.fields.timelineEvent.fields.title);
		}else{
	      for(var i=0;i<entry.fields.timelineEvent.length;i++){ result.timelineEvent.push(entry.fields.timelineEvent[i].fields.title); } 
		}
	  }	 
      family.push(result);
    });
	var data = JSON.stringify(_.sortBy(family, 'updatedAt'));
	var filename = 'contentful/family.json';
	fs.writeFile(filename, data, function (err){ if (err) return console.log(err); });
    console.log("Done! Saved to "+filename);
  });
  
  
  
  /* Nodes */
  
   client.getEntries({ 'content_type': 'nodes',include: 5 }).then(function(entries){
	entries.items.forEach(function(entry){
	var result = {};
	  result.sequenceId = entry.fields.sequenceId;
	  result.location = entry.fields.location;
	  result.yearId = entry.fields.yearId.fields.yearId;
	  result.clue = entry.fields.clue;
	  
	  result.backgroundAsset = entry.fields.backgroundAsset;
	  result.topLevelClusters = [] || {};
	 
	  // Top Level Cluster
	  if(entry.fields.topLevelClusters!==undefined){ 
		var objTopCluster = entry.fields.topLevelClusters;
	    for(var j in objTopCluster){ 
	      if(objTopCluster.hasOwnProperty(j)){
			var objData = new Object();
			objData.family = [] || {};
			objData.characters = [] || {};
			objData.otherRelatedFamilies = [] || { };
	        if(objTopCluster[j].hasOwnProperty("fields")){ 
			  objData.family = objTopCluster[j].fields.name;
			  var objTopClusterCharacters = objTopCluster[j].fields.characters;
			  var charsCollection = [];
	          for(var k in objTopClusterCharacters){ 
			    if(objTopClusterCharacters.hasOwnProperty(k)){ 
				  objChar = new Object();
				  objChar.name = objTopClusterCharacters[k].fields.name;
				  objChar.biographicalData = objTopClusterCharacters[k].fields.biographicalData;
				  objChar.aliasesTitles = objTopClusterCharacters[k].fields.aliasesTitles;
				  objChar.description = objTopClusterCharacters[k].fields.description;
				  
				  objChar.descriptionY0 = objTopClusterCharacters[k].fields.descriptionY0;
				  objChar.descriptionYk = objTopClusterCharacters[k].fields.descriptionYk;
				  objChar.descriptionY2 = objTopClusterCharacters[k].fields.descriptionY2;
				  objChar.descriptionY3 = objTopClusterCharacters[k].fields.descriptionY3;
				  objChar.descriptionY4 = objTopClusterCharacters[k].fields.descriptionY4;
				  objChar.descriptionY5 = objTopClusterCharacters[k].fields.descriptionY5;
				  objChar.descriptionY6 = objTopClusterCharacters[k].fields.descriptionY6;
	  
				  objChar.bustShotFImage = objTopClusterCharacters[k].fields.bustShotFImage;
				  objChar.bustShotY0Image = objTopClusterCharacters[k].fields.bustShotY0Image;
				  objChar.bustShotYkImage = objTopClusterCharacters[k].fields.bustShotYkImage;
				  objChar.bustShotY2Image = objTopClusterCharacters[k].fields.bustShotY2Image;
				  objChar.bustShotY3Image = objTopClusterCharacters[k].fields.bustShotY3Image;
				  objChar.bustShotY4Image = objTopClusterCharacters[k].fields.bustShotY4Image;
				  objChar.bustShotY5Image = objTopClusterCharacters[k].fields.bustShotY5Image;
				  objChar.bustShotY6Image = objTopClusterCharacters[k].fields.bustShotY6Image;
				  objChar.fullSizeY0Image = objTopClusterCharacters[k].fields.fullSizeY0Image;
				  objChar.fullSizeYkImage = objTopClusterCharacters[k].fields.fullSizeYkImage;
	  	  
				  objChar.fullSizeY2Image = objTopClusterCharacters[k].fields.fullSizeY2Image;
				  objChar.fullSizeY3Image = objTopClusterCharacters[k].fields.fullSizeY3Image;
				  objChar.fullSizeY4Image = objTopClusterCharacters[k].fields.fullSizeY4Image;
				  objChar.fullSizeY5Image = objTopClusterCharacters[k].fields.fullSizeY5Image;
				  objChar.fullSizeY6Image = objTopClusterCharacters[k].fields.fullSizeY6Image;
	  	  
				  objChar.fullSizeFImage = objTopClusterCharacters[k].fields.fullSizeFImage;
				  objChar.fullSizeImage = objTopClusterCharacters[k].fields.fullSizeImage;
				 
				  objChar.video = objTopClusterCharacters[k].fields.video;
				  objChar.gallery = objTopClusterCharacters[k].fields.gallery;
				  objChar.playable = objTopClusterCharacters[k].fields.playable;
				  
				  var playableInGame = objTopClusterCharacters[k].fields.playableInGame;
				  var playableInGameArr = [];
				  for(var n in playableInGame){ if(playableInGame.hasOwnProperty(n)){ playableInGameArr.push(playableInGame[n].fields.gameTitle); } }
				  objChar.playableInGame = playableInGameArr;
				  
				  var isHighlighted = objTopClusterCharacters[k].fields.isHighlighted;
				  var isHighlightedArr = [];
				  for(var n in isHighlighted){ if(isHighlighted.hasOwnProperty(n)){ isHighlightedArr.push(isHighlighted[n].fields.sequenceId); } }
				  objChar.isHighlighted = isHighlightedArr;
				  
				  
				  
			      charsCollection.push(objChar);
				} 
			  }
			  objData.characters = charsCollection;
			  
			  
			  // LEVEL 2
			  var objOtherRelatedFamilies = objTopCluster[j].fields.otherRelatedFamilies
			 
			  for(var k in objOtherRelatedFamilies){ 
			    if(objOtherRelatedFamilies.hasOwnProperty(k)){ 
				  var relatedFamilies = new Object();
			      relatedFamilies.family = [] || {}
			      relatedFamilies.characters = [] || {}
				  relatedFamilies.family = objOtherRelatedFamilies[k].fields.name; 
				  relatedFamilies.otherRelatedFamilies = [] || {};
				  var charsCollection = [];
				  var relatedFamiliesCharacters = objOtherRelatedFamilies[k].fields.characters;
				  for(var j in relatedFamiliesCharacters){ 
				    if(relatedFamiliesCharacters.hasOwnProperty(j)){
					  objChar = new Object();
					  objChar.name = relatedFamiliesCharacters[j].fields.name;
					  objChar.biographicalData = relatedFamiliesCharacters[j].fields.biographicalData;
					  objChar.aliasesTitles = relatedFamiliesCharacters[j].fields.aliasesTitles;
					  objChar.description = relatedFamiliesCharacters[j].fields.description;
					  
					  objChar.descriptionY0 = relatedFamiliesCharacters[j].fields.descriptionY0;
					  objChar.descriptionYk = relatedFamiliesCharacters[j].fields.descriptionYk;
					  objChar.descriptionY2 = relatedFamiliesCharacters[j].fields.descriptionY2;
					  objChar.descriptionY3 = relatedFamiliesCharacters[j].fields.descriptionY3;
					  objChar.descriptionY4 = relatedFamiliesCharacters[j].fields.descriptionY4;
					  objChar.descriptionY5 = relatedFamiliesCharacters[j].fields.descriptionY5;
					  objChar.descriptionY6 = relatedFamiliesCharacters[j].fields.descriptionY6;
	  
					  objChar.bustShotFImage = relatedFamiliesCharacters[j].fields.bustShotFImage;
					  objChar.bustShotY0Image = relatedFamiliesCharacters[j].fields.bustShotY0Image;
					  objChar.bustShotYkImage = relatedFamiliesCharacters[j].fields.bustShotYkImage;
					  objChar.bustShotY2Image = relatedFamiliesCharacters[j].fields.bustShotY2Image;
					  objChar.bustShotY3Image = relatedFamiliesCharacters[j].fields.bustShotY3Image;
					  objChar.bustShotY4Image = relatedFamiliesCharacters[j].fields.bustShotY4Image;
					  objChar.bustShotY5Image = relatedFamiliesCharacters[j].fields.bustShotY5Image;
					  objChar.bustShotY6Image = relatedFamiliesCharacters[j].fields.bustShotY6Image;
					  objChar.fullSizeY0Image = relatedFamiliesCharacters[j].fields.fullSizeY0Image;
					  objChar.fullSizeYkImage = relatedFamiliesCharacters[j].fields.fullSizeYkImage;
	  	  
					  objChar.fullSizeY2Image = relatedFamiliesCharacters[j].fields.fullSizeY2Image;
					  objChar.fullSizeY3Image = relatedFamiliesCharacters[j].fields.fullSizeY3Image;
					  objChar.fullSizeY4Image = relatedFamiliesCharacters[j].fields.fullSizeY4Image;
					  objChar.fullSizeY5Image = relatedFamiliesCharacters[j].fields.fullSizeY5Image;
					  objChar.fullSizeY6Image = relatedFamiliesCharacters[j].fields.fullSizeY6Image;
		  
		  			  objChar.fullSizeFImage = relatedFamiliesCharacters[j].fields.fullSizeFImage;
					  objChar.fullSizeImage = relatedFamiliesCharacters[j].fields.fullSizeImage;
					  
					  objChar.video = relatedFamiliesCharacters[j].fields.video;
		  			  objChar.gallery = relatedFamiliesCharacters[j].fields.gallery;
					  
					  var playableInGame = relatedFamiliesCharacters[j].fields.playableInGame;
					  var playableInGameArr = [];
					  for(var n in playableInGame){ if(playableInGame.hasOwnProperty(n)){ playableInGameArr.push(playableInGame[n].fields.gameTitle); } }
					  objChar.playableInGame = playableInGameArr;
					  var isHighlighted = relatedFamiliesCharacters[j].fields.isHighlighted;
					  
					  var isHighlightedArr = [];
					  for(var n in isHighlighted){ if(isHighlighted.hasOwnProperty(n)){ isHighlightedArr.push(isHighlighted[n].fields.sequenceId); } }
					  objChar.isHighlighted = isHighlightedArr;
					  charsCollection.push(objChar); 
					  
					  //charsCollection.push(relatedFamiliesCharacters[j].fields.name) 
					} 
			      }
				  relatedFamilies.characters = charsCollection;
				  objData.otherRelatedFamilies.push(relatedFamilies);
				  
				  // LEVEL 3
				  var objOtherRelatedFamiliesChild = objOtherRelatedFamilies[k].fields.otherRelatedFamilies
				  
				  for(var m in objOtherRelatedFamiliesChild){ 
				    if(objOtherRelatedFamiliesChild.hasOwnProperty(m)){ 
					  var relatedFamiliesChild= new Object();
			      	  relatedFamiliesChild.family = [] || {}
			      	  relatedFamiliesChild.characters = [] || {}
				      relatedFamiliesChild.family = objOtherRelatedFamiliesChild[m].fields.name; 
					  
					  var charsCollection = [];
					  var relatedFamiliesChildCharacters = objOtherRelatedFamiliesChild[m].fields.characters;
					  for(var j in relatedFamiliesChildCharacters){ 
					    if(relatedFamiliesChildCharacters.hasOwnProperty(j)){ 
						  objChar = new Object();
						  objChar.name = relatedFamiliesChildCharacters[j].fields.name;
						  objChar.biographicalData = relatedFamiliesChildCharacters[j].fields.biographicalData;
						  objChar.aliasesTitles = relatedFamiliesChildCharacters[j].fields.aliasesTitles;
						  objChar.description = relatedFamiliesChildCharacters[j].fields.description;
						  
						  objChar.descriptionY0 = relatedFamiliesChildCharacters[j].fields.descriptionY0;
						  objChar.descriptionYk = relatedFamiliesChildCharacters[j].fields.descriptionYk;
						  objChar.descriptionY2 = relatedFamiliesChildCharacters[j].fields.descriptionY2;
						  objChar.descriptionY3 = relatedFamiliesChildCharacters[j].fields.descriptionY3;
						  objChar.descriptionY4 = relatedFamiliesChildCharacters[j].fields.descriptionY4;
						  objChar.descriptionY5 = relatedFamiliesChildCharacters[j].fields.descriptionY5;
						  objChar.descriptionY6 = relatedFamiliesChildCharacters[j].fields.descriptionY6;
	  
						  objChar.bustShotFImage = relatedFamiliesChildCharacters[j].fields.bustShotFImage;
						  objChar.bustShotY0Image = relatedFamiliesChildCharacters[j].fields.bustShotY0Image;
						  objChar.bustShotYkImage = relatedFamiliesChildCharacters[j].fields.bustShotYkImage;
						  objChar.bustShotY2Image = relatedFamiliesChildCharacters[j].fields.bustShotY2Image;
						  objChar.bustShotY3Image = relatedFamiliesChildCharacters[j].fields.bustShotY3Image;
						  objChar.bustShotY4Image = relatedFamiliesChildCharacters[j].fields.bustShotY4Image;
						  objChar.bustShotY5Image = relatedFamiliesChildCharacters[j].fields.bustShotY5Image;
						  objChar.bustShotY6Image = relatedFamiliesChildCharacters[j].fields.bustShotY6Image;
						  objChar.fullSizeY0Image = relatedFamiliesChildCharacters[j].fields.fullSizeY0Image;
						  objChar.fullSizeYkImage = relatedFamiliesChildCharacters[j].fields.fullSizeYkImage;
	  	  
						  objChar.fullSizeY2Image = relatedFamiliesChildCharacters[j].fields.fullSizeY2Image;
						  objChar.fullSizeY3Image = relatedFamiliesChildCharacters[j].fields.fullSizeY3Image;
						  objChar.fullSizeY4Image = relatedFamiliesChildCharacters[j].fields.fullSizeY4Image;
						  objChar.fullSizeY5Image = relatedFamiliesChildCharacters[j].fields.fullSizeY5Image;
						  objChar.fullSizeY6Image = relatedFamiliesChildCharacters[j].fields.fullSizeY6Image;
	  	  
						  objChar.fullSizeFImage = relatedFamiliesChildCharacters[j].fields.fullSizeFImage;
						  objChar.fullSizeImage = relatedFamiliesChildCharacters[j].fields.fullSizeImage;
						  
						  objChar.video = relatedFamiliesChildCharacters[j].fields.video;
						  objChar.gallery = relatedFamiliesChildCharacters[j].fields.gallery;
						  
						  var playableInGame = relatedFamiliesChildCharacters[j].fields.playableInGame;
						  var playableInGameArr = [];
						  for(var n in playableInGame){ if(playableInGame.hasOwnProperty(n)){ playableInGameArr.push(playableInGame[n].fields.gameTitle); } }
						  objChar.playableInGame = playableInGameArr;
						  
						  var isHighlighted = relatedFamiliesChildCharacters[j].fields.isHighlighted;
						  
						  var isHighlightedArr = [];
						  for(var n in isHighlighted){ if(isHighlighted.hasOwnProperty(n)){ isHighlightedArr.push(isHighlighted[n].fields.sequenceId); } }
						  objChar.isHighlighted = isHighlightedArr;
						  
						  charsCollection.push(objChar);
						} 
					  }
					  relatedFamiliesChild.characters = charsCollection;
					  relatedFamilies.otherRelatedFamilies.push(relatedFamiliesChild);
					}
				  }
				  
				  
				}
			  }
			
			  result.topLevelClusters.push(objData);
			  
   		    }
		  }
		}
		
	  }
	  
	  
	  
	  
	  
	  
	  // Main Cluster
	  result.mainCluster = [] || {};
	  if(entry.fields.mainCluster!==undefined){ 
	    var objData = new Object();
		var objMainCluster = entry.fields.mainCluster;
	    for(var j in objMainCluster){ 
	      if(objMainCluster.hasOwnProperty(j)){
	        if(objMainCluster[j].hasOwnProperty("name")){ 
	          //result.mainCluster.push(objMainCluster[j].name);
			   objData.family = objMainCluster[j].name;
			 }
			
			/*
			var objMainClusterCharacters = objMainCluster[j].characters;
			var charsCollection = [];
	        for(var k in objMainClusterCharacters){ 
			   if(objMainClusterCharacters.hasOwnProperty(k)){
				 objChar = new Object();
				 objChar.name = objMainClusterCharacters[k].fields.name;
				 objChar.biographicalData = objMainClusterCharacters[k].fields.biographicalData;
				 objChar.aliasesTitles = objMainClusterCharacters[k].fields.aliasesTitles;
				 objChar.description = objMainClusterCharacters[k].fields.description;
	  
				 objChar.bustShotFImage = objMainClusterCharacters[k].fields.bustShotFImage;
				 objChar.bustShotY0Image = objMainClusterCharacters[k].fields.bustShotY0Image;
				 objChar.bustShotYkImage = objMainClusterCharacters[k].fields.bustShotYkImage;
				 objChar.bustShotY2Image = objMainClusterCharacters[k].fields.bustShotY2Image;
				 objChar.bustShotY3Image = objMainClusterCharacters[k].fields.bustShotY3Image;
				 objChar.bustShotY4Image = objMainClusterCharacters[k].fields.bustShotY4Image;
				 objChar.bustShotY5Image = objMainClusterCharacters[k].fields.bustShotY5Image;
				 objChar.bustShotY6Image = objMainClusterCharacters[k].fields.bustShotY6Image;
				 objChar.fullSizeY0Image = objMainClusterCharacters[k].fields.fullSizeY0Image;
				 objChar.fullSizeYkImage = objMainClusterCharacters[k].fields.fullSizeYkImage;
	  	  
				 objChar.fullSizeY2Image = objMainClusterCharacters[k].fields.fullSizeY2Image;
				 objChar.fullSizeY3Image = objMainClusterCharacters[k].fields.fullSizeY3Image;
				 objChar.fullSizeY4Image = objMainClusterCharacters[k].fields.fullSizeY4Image;
				 objChar.fullSizeY5Image = objMainClusterCharacters[k].fields.fullSizeY5Image;
				 objChar.fullSizeY6Image = objMainClusterCharacters[k].fields.fullSizeY6Image;
	  	  
				 objChar.fullSizeImage = objMainClusterCharacters[k].fields.fullSizeImage;
				 
				 var playableInGame = objMainClusterCharacters[k].fields.playableInGame;
				 var playableInGameArr = [];
				 for(var n in playableInGame){ if(playableInGame.hasOwnProperty(n)){ playableInGameArr.push(playableInGame[n].fields.gameTitle); } }
				 objChar.playableInGame = playableInGameArr;
				 
				 charsCollection.push(objChar);
			     //charsCollection.push(objMainClusterCharacters[k].fields.name)
			     //console.log(objMainClusterCharacters[k].fields.name);
			   }
	        }*/
			//objData.characters = charsCollection;
			result.mainCluster = objData;
   		  }
		}
	  }
	  
	  // Event in Timeline
	  
	  result.eventInTimeline = [];
	  if(entry.fields.eventInTimeline!==undefined){ 
	     
	    if(entry.fields.eventInTimeline.length===undefined){ 
		 
		  result.eventInTimeline.push(entry.fields.eventInTimeline.fields.title); 
		}else{
		 // console.log(entry.fields.eventInTimeline[i].fields);
		  for(var i=0;i<entry.fields.eventInTimeline.length;i++){ result.eventInTimeline.push(entry.fields.eventInTimeline[i].fields.title); }
		}
	  }
	  
	  // Game Filter
	  
	  result.gameFilter = [];
	  if(entry.fields.gameFilter!==undefined){ 
	    if(entry.fields.gameFilter.length===undefined){ 
		  result.gameFilter.push(entry.fields.gameFilter.fields.gameTitle); 
		}else{
		  for(var i=0;i<entry.fields.gameFilter.length;i++){ result.gameFilter.push(entry.fields.gameFilter[i].fields.gameTitle); }
		}
	  }
      nodes.push(result);
    });
	var data = JSON.stringify(nodes);
	var filename = 'contentful/nodes.json';
	fs.writeFile(filename, data, function (err){ if (err) return console.log(err); });
    console.log("Done! Saved to "+filename);
  });
  
  /* G
     A
	 M
	 E */
  
  client.getEntries({ 'content_type': 'game' }).then(function(entries){
	
	entries.items.forEach(function(entry){
		//console.log(entry);
	var result = {};
	  result.gameTitle = entry.fields.gameTitle;
	  result.gameDescription = entry.fields.gameDescription;
	  result.chronology = entry.fields.chronology;
      game.push(result);
    });
	var data = JSON.stringify(_.sortBy(game, 'chronology'));
	var filename = 'contentful/game.json';
	fs.writeFile(filename, data, function (err){ if (err) return console.log(err); });
    console.log("Done! Saved to "+filename);
  });
  
  
  /* S
     E
	 T
	 T
	 I
	 N
	 G
	 S */
  
  client.getEntries({ 'content_type': 'settings' }).then(function(entries){
	entries.items.forEach(function(entry){
	var result = {};
	  result.productionUrl = entry.fields.productionUrl;
	  result.developmentUrl = entry.fields.developmentUrl;
	  result.stageUrl = entry.fields.stageUrl;
      settings.push(result);
    });
	var data = JSON.stringify(settings);
	var filename = 'contentful/settings.json';
	fs.writeFile(filename, data, function (err){ if (err) return console.log(err); });
    console.log("Done! Saved to "+filename);
  });
  
  /* T
     I
	 M
	 E
	 L
	 I
	 N
	 E */
  
  client.getEntries({ 'content_type': 'timeline' }).then(function(entries){
	entries.items.forEach(function(entry){
	  var result = {};
	  result.yearId = [];
	  if(entry.fields.yearId!==undefined){ 
	    if(entry.fields.yearId.length===undefined){ 
		  result.yearId.push(entry.fields.yearId.fields.yearId);
		}else{
	      for(var i=0;i<entry.fields.yearId[i].length;i++){ result.yearId.push(entry.fields.yearId[i].fields.yearId); }
		}
      }	 
	  
	  result.videoPoster = entry.fields.videoPoster;
	  result.sequence = entry.fields.sequence;
	  result.title = entry.fields.title;
	  result.clue = entry.fields.clue;
	  result.location = entry.fields.location;
	  result.description = entry.fields.description;
	  result.game = [];
	  if(entry.fields.game!==undefined){ 
	    if(entry.fields.game.length===undefined){ 
		  result.game.push(entry.fields.game.fields.gameTitle);
		}else{
		  for(var i=0;i<entry.fields.game.length;i++){ result.game.push(entry.fields.game[i].fields.gameTitle); } 
		}
	  }	 
	  result.video = entry.fields.video;
	  result.gallery = entry.fields.gallery;
	  result.characterMapSequenceId = entry.fields.characterMapSequenceId;
      timeline.push(result);
    });
	var data = JSON.stringify(timeline);
	var filename = 'contentful/timeline.json';
	fs.writeFile(filename, data, function (err){ if (err) return console.log(err); });
    console.log("Done! Saved to "+filename);
  });
  
 
  
  
  
});




