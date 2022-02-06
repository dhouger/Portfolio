// Section: Push Flow notifications for Moderators/Admins.
//          These functions take whatever is in the options flow
//          panel and writes it to a self-contained html document.
//          The doc is stringified/escaped and sent to the options
//          server to be translated into an image.
function showPushFlow() {
  closePopovers();

  if (
    !$("#optionsTable") ||
    !$("#optionsTable").children("tbody") ||
    !$("#optionsTable").children("tbody").children("tr") ||
    !$("#optionsTable").children("tbody").children("tr").children("td")
  ) {
    return;
  } else if (
    $("#optionsTable").children("tbody").children("tr").children("td").length <=
    1
  ) {
    var cell = $("#optionsTable")
      .children("tbody")
      .children("tr")
      .children("td")[0];
    var errorText = document.createElement("p");
    errorText.style.color = "red";
    errorText.style.display = "inline";
    errorText.innerHTML =
      "  Error: Cannot create a flowplay with empty options!";
    cell.innerHTML += errorText.outerHTML;
    return;
  } else {
    $("#confirmPushPanel").data("kendoDialog").open();
    $("#flowPlayDescription").focus();
  }
}

$("#flowPlayDescription").on("input", function () {
  if (this.value == "") $("#btnSaveAlert").prop("disabled", true);
  else $("#btnSaveAlert").prop("disabled", false);

  $("#remainingPlayDesc").text(
    "Characters Remaining: " + (2000 - this.value.length)
  );
});

function handleAlertCancel(e) {
  flowplayPush.data("kendoDialog").close();
}
function handleAlertSave(e) {
  var optionsTable = document.getElementById("optionsTable");
  var table = optionsTable.cloneNode(true);

  playMetadata.IsSet = false;

  copyComputedStyle(optionsTable);
  table.removeAttribute("class");

  // Loop through all the rows/cells of the table and copy their CSS styling
  for (var i = 0; i < table.children.length; i++) {
    inlineCSS(table.children[i], optionsTable.children[i]);
  }

  // This is essentially just to remove the width tag; width is statically set in getDimensions
  var body = table.getElementsByTagName("tbody")[0];
  body.removeAttribute("style");

  // Pull the created rules and create the body of the <style> tag
  var rules = "";
  for (var rule in cssRules)
    if (typeof cssRules[rule] == "string") rules += cssRules[rule] + "\r\n\r\n";

  // Format/create the entire HTML doc
  var s =
    "<!DOCTYPE html>\r\n<html>\r\n<head>\r\n<title>Flow Play</title>\r\n<style>\r\n" +
    rules +
    "\r\n</style>\r\n" +
    '</head>\r\n<body style="background-color: #192026;">\r\n' +
    table.outerHTML +
    "\r\n</body>\r\n</html>";

  // Escaped to allow the string to be sent to the API and parsed there
  // Without this step, IIS automatically blocks HTML strings being sent
  var escaped = escape(s);
  //console.log(s);

  $("#confirmPushPanel").data("kendoDialog").close();

  var d = getDimensions();

  // Do the push request to create the image
  $.ajax({
    url: optionsServer + "/img/htmltojpg",
    type: "POST",
    data: {
      HTML: escaped,
      Height: d.h,
      Width: d.w,
    },
    beforeSend: function (xhr) {
      xhr.setRequestHeader("X-ApiKey", bbApiKey);
    },
    success: function (imgUrl) {
      var flowPlay = {
        ImageUrl: imgUrl,
        Description: $("#flowPlayDescription").val(),
        Symbol: playMetadata.Symbol,
        Expiration: playMetadata.Expiration,
        Strike: playMetadata.Strike,
        CallOrPut: playMetadata.CallOrPut,
        ImgHeight: d.h,
        ImgWidth: d.w,
      };

      // Create the flow play entry in MySQL
      // NOTE: For any future debugging on image creation, comment this
      //          out to avoid creating unecessary images
      if (flowPlay.ImageUrl) {
        $.post("/BlackBox/AddFlowPlay", flowPlay)
          .done(function (data) {
            //console.log(imgUrl);
          })
          .fail(function (e) {
            console.error(e);
          })
          .error(function (err) {
            alert("Error: " + err.statusText);
          })
          .complete(function () {
            playMetadata = {
              Symbol: "",
              Expiration: "",
              Strike: "",
              CallOrPut: "",
              IsSet: false,
            };
          });
      } else {
        console.error("Failed to write image to AWS");

        playMetadata = {
          Symbol: "",
          Expiration: "",
          Strike: "",
          CallOrPut: "",
          IsSet: false,
        };
      }
    },
    error: function (e) {
      console.error(e);
    },
    complete: function () {
      cssRules = [];
      $("#flowPlayDescription").val("");
      $("#btnSaveAlert").prop("disabled", true);
      //console.log("AJAX COMPLETE!!")
    },
  });
}

// This function copies the inline CSS and merges the last 5 cells of a row with the first 5 cells
//      to compress the image width and make it easier to fit into chat; per spec.
function inlineCSS(element, original) {
  var tag =
    element.children.length > 0
      ? element.children[0].tagName.toLowerCase()
      : "";

  if (element.children.length > 0 && tag != "th" && tag != "td") {
    if (element.tagName.toLowerCase() == "div") element.style.height = "";

    for (var i = 0; i < element.children.length; i++)
      inlineCSS(element.children[i], original.children[i]);
  } else if (element.tagName.toLowerCase() == "tr") {
    var children = document.createElement("tr");
    var dim = getDimensions();
    for (var c = 5; c < element.children.length; c++) {
      if (
        !playMetadata.IsSet &&
        original.parentElement.tagName.toLowerCase() != "thead"
      ) {
        playMetadata.Symbol = currentSymbol;
        playMetadata.Expiration = original.children[2].textContent;
        playMetadata.Strike = original.children[3].textContent;
        playMetadata.CallOrPut = original.children[4].textContent;
        playMetadata.IsSet = true;
      }

      var t = document.createElement(tag);
      var top = original.children[c - 5];
      var bottom = original.children[c];

      copyComputedStyle(top);

      // Merges the cells & keeps the PUT/CALL colors without changing the row color
      if (c == element.children.length - 1 && tag != "th") {
        var p = document.createElement("p");
        p.style.margin = "0";
        p.innerHTML = top.innerHTML;
        p.style.color = window.getComputedStyle(top).color;
        t.append(p);
        t.innerHTML += bottom.innerHTML;

        if (bottom.style.cssText) {
          t.style.cssText = bottom.style.cssText;
          t.style.padding =
            dim.paddingSize + "px " + dim.padSizeCellRight + "px";
        }
      } else {
        t.innerHTML = top.innerHTML;
        t.append(document.createElement("br"));
        t.innerHTML += bottom.innerHTML;

        if (top.style.cssText && tag != "tbody")
          t.style.cssText = top.style.cssText;
      }

      children.appendChild(t);
    }

    element.innerHTML = children.innerHTML;
  }

  copyComputedStyle(original);
  element.removeAttribute("class");
}

// Sets the dimensions for copied HTML. This is mostly static because the webBrowser created
//      by the API doesn't perfectly match CSS interpretation in Chrome.
function getDimensions() {
  var percent = 1.666666666666;
  var height = 0;
  var width = Math.round(353 * percent); //Static for now

  var table = document.getElementById("optionsTable");
  var rows = table.getElementsByTagName("tr");

  height = Math.round((rows.length ? rows.length * 41 : 800) * percent);

  var cells = rows[0].getElementsByTagName("th");

  return {
    h: height,
    w: width,
    contentWidth: width - 19,
    percent: percent,
    borderSize: Math.round(2 * percent),
    fontSize: Math.round(10 * percent),
    paddingSize: Math.round(8 * percent),
    padSizeCellRight: Math.round(6 * percent),
  };
}

// Credit: https://stackoverflow.com/a/1848489/825477
function realStyle(_elem, _style) {
  var computedStyle;
  if (typeof _elem.currentStyle != "undefined") {
    computedStyle = _elem.currentStyle;
  } else {
    computedStyle = document.defaultView.getComputedStyle(_elem, null);
  }

  return _style ? computedStyle[_style] : computedStyle;
}

var playMetadata = {
  Symbol: "",
  Expiration: "",
  Strike: "",
  CallOrPut: "",
  IsSet: false,
};

var rules = {
  border: true,
  bottom: true,
  color: true,
  display: true,
  font: true,
  grid: true,
  height: true,
  left: true,
  margin: true,
  padding: true,
  position: true,
  visibility: true,
  width: true,
};

function copyComputedStyle(src) {
  var s = realStyle(src);
  var tag = src.tagName.toLowerCase();

  var customSelectors = {
    border: true,
    font: true,
    padding: true,
    margin: true,
    width: true,
  };

  // These selectors are used to exclude a CSS rule after a custom selector value has been set for that rule
  var excludeSelectors = {
    border: false,
  };

  if (!cssRules[tag]) {
    var rule = tag + " {\r\n";

    for (var i = 0; i < s.length; i++) {
      var prop = s[i];
      var val = s.getPropertyValue(prop);

      if (val) {
        try {
          var splitSelector = prop.split("-")[0];

          // style rules to skip copying
          if (
            (prop == "color" && tag == "td") ||
            (prop == "width" && tag != "table") ||
            prop == "height" ||
            prop == "font-size"
          )
            continue;
          else if (!rules[prop] && !rules[splitSelector]) continue;

          var dim = getDimensions();

          // overwritten/custom rules
          if (tag == "table" && prop == "width") {
            rule += "    width: " + getDimensions().contentWidth + "px;\r\n";
            customSelectors[splitSelector] = false;
          } else if (
            (tag == "th" || tag == "td") &&
            customSelectors[splitSelector] &&
            splitSelector == "border"
          ) {
            rule +=
              "    border-bottom: solid " +
              dim.borderSize +
              "px #6ED25A !important;\r\n";
            customSelectors[splitSelector] = false;
          } else if (
            customSelectors[splitSelector] &&
            splitSelector == "font"
          ) {
            rule +=
              "    font: " +
              dim.fontSize +
              'px "sans-serif";\r\nfont-family: "Helvetica";\r\n';
            customSelectors[splitSelector] = false;
          } else if (
            customSelectors[splitSelector] &&
            splitSelector == "padding"
          ) {
            rule +=
              "    padding: " +
              dim.paddingSize +
              "px " +
              dim.paddingSize +
              "px;\r\n";
            customSelectors[splitSelector] = false;
          } else if (
            customSelectors[splitSelector] &&
            splitSelector == "margin"
          ) {
            rule += "    margin: 0;\r\n";
            customSelectors[splitSelector] = false;
          } else rule += "    " + prop + ": " + val + ";\r\n";
        } catch (e) {
          console.error(e);
        }
      }
    }

    rule += "}";

    cssRules[tag] = rule;
  }
}
// End of Flow Alert section
