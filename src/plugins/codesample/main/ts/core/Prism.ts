/**
 * Prism.js
 *
 * Released under LGPL License.
 * Copyright (c) 1999-2017 Ephox Corp. All rights reserved
 *
 * License: http://www.tinymce.com/license
 * Contributing: http://www.tinymce.com/contributing
 *
 * Import of prism. Disabled DOMContentLoaded event listener.
 */

import { self, document, Worker } from '@ephox/dom-globals';

/*eslint-disable*/

/*eslint-enable */

declare const WorkerGlobalScope: any;

const window: any = {};
const global: any = window;
const module: any = { exports: {} };

// ------------------ Start wrap

/* http://prismjs.com/download.html?themes=prism-dark&languages=markup+css+clike+javascript+c+csharp+cpp+java+php+python+ruby */
const _self: any = (typeof window !== 'undefined')
  ? window   // if in browser
  : (
    (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope)
      ? self // if in worker
      : {}   // if in node js
  );

/**
 * Prism: Lightweight, robust, elegant syntax highlighting
 * MIT license http://www.opensource.org/licenses/mit-license.php/
 * @author Lea Verou http://lea.verou.me
 */

const Prism = (function () {

  // Private helper vars
  const lang = /\blang(?:uage)?-(?!\*)(\w+)\b/i;

  const _: any = _self.Prism = {
    util: {
      encode (tokens) {
        if (tokens instanceof Token) {
          return new Token(tokens.type, _.util.encode(tokens.content), tokens.alias);
        } else if (_.util.type(tokens) === 'Array') {
          return tokens.map(_.util.encode);
        } else {
          return tokens.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
        }
      },

      type (o) {
        return Object.prototype.toString.call(o).match(/\[object (\w+)\]/)[1];
      },

      // Deep clone a language definition (e.g. to extend it)
      clone (o) {
        const type = _.util.type(o);

        switch (type) {
          case 'Object':
            const clone = {};

            for (const key in o) {
              if (o.hasOwnProperty(key)) {
                clone[key] = _.util.clone(o[key]);
              }
            }

            return clone;

          case 'Array':
            // Check for existence for IE8
            return o.map && o.map(function (v) { return _.util.clone(v); });
        }

        return o;
      }
    },

    languages: {
      extend (id, redef) {
        const lang = _.util.clone(_.languages[id]);

        for (const key in redef) {
          lang[key] = redef[key];
        }

        return lang;
      },

      /**
       * Insert a token before another token in a language literal
       * As this needs to recreate the object (we cannot actually insert before keys in object literals),
       * we cannot just provide an object, we need anobject and a key.
       * @param inside The key (or language id) of the parent
       * @param before The key to insert before. If not provided, the function appends instead.
       * @param insert Object with the key/value pairs to insert
       * @param root The object that contains `inside`. If equal to Prism.languages, it can be omitted.
       */
      insertBefore (inside, before, insert, root) {
        root = root || _.languages;
        const grammar = root[inside];

        if (arguments.length === 2) {
          insert = arguments[1];

          for (const newToken in insert) {
            if (insert.hasOwnProperty(newToken)) {
              grammar[newToken] = insert[newToken];
            }
          }

          return grammar;
        }

        const ret = {};

        for (const token in grammar) {

          if (grammar.hasOwnProperty(token)) {

            if (token === before) {

              for (const newToken in insert) {

                if (insert.hasOwnProperty(newToken)) {
                  ret[newToken] = insert[newToken];
                }
              }
            }

            ret[token] = grammar[token];
          }
        }

        // Update references in other language definitions
        _.languages.DFS(_.languages, function (key, value) {
          if (value === root[inside] && key !== inside) {
            this[key] = ret;
          }
        });

        return root[inside] = ret;
      },

      // Traverse a language definition with Depth First Search
      DFS: <any> function (o, callback, type) {
        for (const i in o) {
          if (o.hasOwnProperty(i)) {
            callback.call(o, i, o[i], type || i);

            if (_.util.type(o[i]) === 'Object') {
              _.languages.DFS(o[i], callback);
            } else if (_.util.type(o[i]) === 'Array') {
              _.languages.DFS(o[i], callback, i);
            }
          }
        }
      }
    },
    plugins: {},

    highlightAll (async, callback) {
      const elements = document.querySelectorAll('code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code');

      for (let i = 0, element; element = elements[i++];) {
        _.highlightElement(element, async === true, callback);
      }
    },

    highlightElement (element, async, callback) {
      // Find language
      let language, grammar, parent = element;

      while (parent && !lang.test(parent.className)) {
        parent = parent.parentNode;
      }

      if (parent) {
        language = (parent.className.match(lang) || [, ''])[1];
        grammar = _.languages[language];
      }

      // Set language on the element, if not present
      element.className = element.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;

      // Set language on the parent, for styling
      parent = element.parentNode;

      if (/pre/i.test(parent.nodeName)) {
        parent.className = parent.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;
      }

      const code = element.textContent;

      const env: any = {
        element,
        language,
        grammar,
        code
      };

      if (!code || !grammar) {
        _.hooks.run('complete', env);
        return;
      }

      _.hooks.run('before-highlight', env);

      if (async && _self.Worker) {
        const worker = new Worker(_.filename);

        worker.onmessage = function (evt) {
          env.highlightedCode = evt.data;

          _.hooks.run('before-insert', env);

          env.element.innerHTML = env.highlightedCode;

          if (callback) {
            callback.call(env.element);
          }
          _.hooks.run('after-highlight', env);
          _.hooks.run('complete', env);
        };

        worker.postMessage(JSON.stringify({
          language: env.language,
          code: env.code,
          immediateClose: true
        }));
      } else {
        env.highlightedCode = _.highlight(env.code, env.grammar, env.language);

        _.hooks.run('before-insert', env);

        env.element.innerHTML = env.highlightedCode;

        if (callback) {
          callback.call(element);
        }

        _.hooks.run('after-highlight', env);
        _.hooks.run('complete', env);
      }
    },

    highlight (text, grammar, language) {
      const tokens = _.tokenize(text, grammar);
      return Token.stringify(_.util.encode(tokens), language);
    },

    tokenize (text, grammar, language) {
      const Token = _.Token;

      const strarr = [text];

      const rest = grammar.rest;

      if (rest) {
        for (const token in rest) {
          grammar[token] = rest[token];
        }

        delete grammar.rest;
      }

      tokenloop: for (const token in grammar) {
        if (!grammar.hasOwnProperty(token) || !grammar[token]) {
          continue;
        }

        let patterns = grammar[token];
        patterns = (_.util.type(patterns) === 'Array') ? patterns : [patterns];

        for (let j = 0; j < patterns.length; ++j) {
          let pattern = patterns[j];
          const inside = pattern.inside;
          const lookbehind = !!pattern.lookbehind;
          let lookbehindLength = 0;
          const alias = pattern.alias;

          pattern = pattern.pattern || pattern;

          for (let i = 0; i < strarr.length; i++) { // Don’t cache length as it changes during the loop

            const str = strarr[i];

            if (strarr.length > text.length) {
              // Something went terribly wrong, ABORT, ABORT!
              break tokenloop;
            }

            if (str instanceof Token) {
              continue;
            }

            pattern.lastIndex = 0;

            let match = pattern.exec(str);

            if (match) {
              if (lookbehind) {
                lookbehindLength = match[1].length;
              }

              const from = match.index - 1 + lookbehindLength;
              match = match[0].slice(lookbehindLength);
              const len = match.length,
                to = from + len,
                before = str.slice(0, from + 1),
                after = str.slice(to + 1);

              const args = [i, 1];

              if (before) {
                args.push(before);
              }

              const wrapped = new Token(token, inside ? _.tokenize(match, inside) : match, alias);

              args.push(wrapped);

              if (after) {
                args.push(after);
              }

              Array.prototype.splice.apply(strarr, args);
            }
          }
        }
      }

      return strarr;
    },

    hooks: {
      all: {},

      add (name, callback) {
        const hooks = _.hooks.all;

        hooks[name] = hooks[name] || [];

        hooks[name].push(callback);
      },

      run (name, env) {
        const callbacks = _.hooks.all[name];

        if (!callbacks || !callbacks.length) {
          return;
        }

        for (let i = 0, callback; callback = callbacks[i++];) {
          callback(env);
        }
      }
    }
  };

  const Token: any = _.Token = function (type, content, alias) {
    this.type = type;
    this.content = content;
    this.alias = alias;
  };

  Token.stringify = function (o, language, parent) {
    if (typeof o === 'string') {
      return o;
    }

    if (_.util.type(o) === 'Array') {
      return o.map(function (element) {
        return Token.stringify(element, language, o);
      }).join('');
    }

    const env: any = {
      type: o.type,
      content: Token.stringify(o.content, language, parent),
      tag: 'span',
      classes: ['token', o.type],
      attributes: {},
      language,
      parent
    };

    if (env.type === 'comment') {
      env.attributes.spellcheck = 'true';
    }

    if (o.alias) {
      const aliases = _.util.type(o.alias) === 'Array' ? o.alias : [o.alias];
      Array.prototype.push.apply(env.classes, aliases);
    }

    _.hooks.run('wrap', env);

    let attributes = '';

    for (const name in env.attributes) {
      attributes += (attributes ? ' ' : '') + name + '="' + (env.attributes[name] || '') + '"';
    }

    return '<' + env.tag + ' class="' + env.classes.join(' ') + '" ' + attributes + '>' + env.content + '</' + env.tag + '>';

  };

  if (!_self.document) {
    if (!_self.addEventListener) {
      // in Node.js
      return _self.Prism;
    }
    // In worker
    _self.addEventListener('message', function (evt) {
      const message = JSON.parse(evt.data),
        lang = message.language,
        code = message.code,
        immediateClose = message.immediateClose;

      _self.postMessage(_.highlight(code, _.languages[lang], lang));
      if (immediateClose) {
        _self.close();
      }
    }, false);

    return _self.Prism;
  }
  /*
  // Get current script and highlight
  var script = document.getElementsByTagName('script');

  script = script[script.length - 1];

  if (script) {
    _.filename = script.src;

    if (document.addEventListener && !script.hasAttribute('data-manual')) {
      document.addEventListener('DOMContentLoaded', _.highlightAll);
    }
  }

  return _self.Prism;
  */
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Prism;
}

// hack for components to work correctly in node.js
if (typeof global !== 'undefined') {
  global.Prism = Prism;
}
Prism.languages.markup = {
  comment: /<!--[\w\W]*?-->/,
  prolog: /<\?[\w\W]+?\?>/,
  doctype: /<!DOCTYPE[\w\W]+?>/,
  cdata: /<!\[CDATA\[[\w\W]*?]]>/i,
  tag: {
    pattern: /<\/?[^\s>\/=.]+(?:\s+[^\s>\/=]+(?:=(?:("|')(?:\\\1|\\?(?!\1)[\w\W])*\1|[^\s'">=]+))?)*\s*\/?>/i,
    inside: {
      'tag': {
        pattern: /^<\/?[^\s>\/]+/i,
        inside: {
          punctuation: /^<\/?/,
          namespace: /^[^\s>\/:]+:/
        }
      },
      'attr-value': {
        pattern: /=(?:('|")[\w\W]*?(\1)|[^\s>]+)/i,
        inside: {
          punctuation: /[=>"']/
        }
      },
      'punctuation': /\/?>/,
      'attr-name': {
        pattern: /[^\s>\/]+/,
        inside: {
          namespace: /^[^\s>\/:]+:/
        }
      }

    }
  },
  entity: /&#?[\da-z]{1,8};/i
};

// Plugin to make entity title show the real entity, idea by Roman Komarov
Prism.hooks.add('wrap', function (env) {

  if (env.type === 'entity') {
    env.attributes.title = env.content.replace(/&amp;/, '&');
  }
});

Prism.languages.xml = Prism.languages.markup;
Prism.languages.html = Prism.languages.markup;
Prism.languages.mathml = Prism.languages.markup;
Prism.languages.svg = Prism.languages.markup;

Prism.languages.css = {
  comment: /\/\*[\w\W]*?\*\//,
  atrule: {
    pattern: /@[\w-]+?.*?(;|(?=\s*\{))/i,
    inside: {
      rule: /@[\w-]+/
      // See rest below
    }
  },
  url: /url\((?:(["'])(\\(?:\r\n|[\w\W])|(?!\1)[^\\\r\n])*\1|.*?)\)/i,
  selector: /[^\{\}\s][^\{\};]*?(?=\s*\{)/,
  string: /("|')(\\(?:\r\n|[\w\W])|(?!\1)[^\\\r\n])*\1/,
  property: /(\b|\B)[\w-]+(?=\s*:)/i,
  important: /\B!important\b/i,
  function: /[-a-z0-9]+(?=\()/i,
  punctuation: /[(){};:]/
};

Prism.languages.css.atrule.inside.rest = Prism.util.clone(Prism.languages.css);

if (Prism.languages.markup) {
  Prism.languages.insertBefore('markup', 'tag', {
    style: {
      pattern: /<style[\w\W]*?>[\w\W]*?<\/style>/i,
      inside: {
        tag: {
          pattern: /<style[\w\W]*?>|<\/style>/i,
          inside: Prism.languages.markup.tag.inside
        },
        rest: Prism.languages.css
      },
      alias: 'language-css'
    }
  });

  Prism.languages.insertBefore('inside', 'attr-value', {
    'style-attr': {
      pattern: /\s*style=("|').*?\1/i,
      inside: {
        'attr-name': {
          pattern: /^\s*style/i,
          inside: Prism.languages.markup.tag.inside
        },
        'punctuation': /^\s*=\s*['"]|['"]\s*$/,
        'attr-value': {
          pattern: /.+/i,
          inside: Prism.languages.css
        }
      },
      alias: 'language-css'
    }
  }, Prism.languages.markup.tag);
}
Prism.languages.clike = {
  'comment': [
    {
      pattern: /(^|[^\\])\/\*[\w\W]*?\*\//,
      lookbehind: true
    },
    {
      pattern: /(^|[^\\:])\/\/.*/,
      lookbehind: true
    }
  ],
  'string': /(["'])(\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
  'class-name': {
    pattern: /((?:\b(?:class|interface|extends|implements|trait|instanceof|new)\s+)|(?:catch\s+\())[a-z0-9_\.\\]+/i,
    lookbehind: true,
    inside: {
      punctuation: /(\.|\\)/
    }
  },
  'keyword': /\b(if|else|while|do|for|return|in|instanceof|function|new|try|throw|catch|finally|null|break|continue)\b/,
  'boolean': /\b(true|false)\b/,
  'function': /[a-z0-9_]+(?=\()/i,
  'number': /\b-?(?:0x[\da-f]+|\d*\.?\d+(?:e[+-]?\d+)?)\b/i,
  'operator': /--?|\+\+?|!=?=?|<=?|>=?|==?=?|&&?|\|\|?|\?|\*|\/|~|\^|%/,
  'punctuation': /[{}[\];(),.:]/
};

Prism.languages.docker = {
	'keyword': {
		pattern: /(^\s*)(?:ADD|ARG|CMD|COPY|ENTRYPOINT|ENV|EXPOSE|FROM|HEALTHCHECK|LABEL|MAINTAINER|ONBUILD|RUN|SHELL|STOPSIGNAL|USER|VOLUME|WORKDIR)(?=\s)/mi,
		lookbehind: true
	},
	'string': /("|')(?:(?!\1)[^\\\r\n]|\\(?:\r\n|[\s\S]))*\1/,
	'comment': /#.*/,
	'punctuation': /---|\.\.\.|[:[\]{}\-,|>?]/
};

Prism.languages.dockerfile = Prism.languages.docker;


Prism.languages.rust = {
	'comment': [
		{
			pattern: /(^|[^\\])\/\*[\s\S]*?\*\//,
			lookbehind: true
		},
		{
			pattern: /(^|[^\\:])\/\/.*/,
			lookbehind: true
		}
	],
	'string': [
		{
			pattern: /b?r(#*)"(?:\\.|(?!"\1)[^\\\r\n])*"\1/,
			greedy: true
		},
		{
			pattern: /b?"(?:\\.|[^\\\r\n"])*"/,
			greedy: true
		}
	],
	'char': {
		pattern: /b?'(?:\\(?:x[0-7][\da-fA-F]|u{(?:[\da-fA-F]_*){1,6}|.)|[^\\\r\n\t'])'/,
		alias: 'string'
	},
	'lifetime-annotation': {
		pattern: /'[^\s>']+/,
		alias: 'symbol'
	},
	'keyword': /\b(?:abstract|alignof|as|be|box|break|const|continue|crate|do|else|enum|extern|false|final|fn|for|if|impl|in|let|loop|match|mod|move|mut|offsetof|once|override|priv|pub|pure|ref|return|sizeof|static|self|struct|super|true|trait|type|typeof|unsafe|unsized|use|virtual|where|while|yield)\b/,

	'attribute': {
		pattern: /#!?\[.+?\]/,
		greedy: true,
		alias: 'attr-name'
	},

	'function': [
		/\w+(?=\s*\()/,
		// Macros can use parens or brackets
		/\w+!(?=\s*\(|\[)/
	],
	'macro-rules': {
		pattern: /\w+!/,
		alias: 'function'
	},

	// Hex, oct, bin, dec numbers with visual separators and type suffix
	'number': /\b(?:0x[\dA-Fa-f](?:_?[\dA-Fa-f])*|0o[0-7](?:_?[0-7])*|0b[01](?:_?[01])*|(\d(?:_?\d)*)?\.?\d(?:_?\d)*(?:[Ee][+-]?\d+)?)(?:_?(?:[iu](?:8|16|32|64)?|f32|f64))?\b/,

	// Closure params should not be confused with bitwise OR |
	'closure-params': {
		pattern: /\|[^|]*\|(?=\s*[{-])/,
		inside: {
			'punctuation': /[|:,]/,
			'operator': /[&*]/
		}
	},
	'punctuation': /[{}[\];(),:]|\.+|->/,
	'operator': /[-+*\/%!^]=?|=[=>]?|@|&[&=]?|\|[|=]?|<<?=?|>>?=?/
};


Prism.languages.javascript = Prism.languages.extend('clike', {
  keyword: /\b(as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|false|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|true|try|typeof|var|void|while|with|yield)\b/,
  number: /\b-?(0x[\dA-Fa-f]+|0b[01]+|0o[0-7]+|\d*\.?\d+([Ee][+-]?\d+)?|NaN|Infinity)\b/,
  // Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
  function: /[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*(?=\()/i
});

Prism.languages.insertBefore('javascript', 'keyword', {
  regex: {
    pattern: /(^|[^/])\/(?!\/)(\[.+?]|\\.|[^/\\\r\n])+\/[gimyu]{0,5}(?=\s*($|[\r\n,.;})]))/,
    lookbehind: true
  }
});

Prism.languages.insertBefore('javascript', 'class-name', {
  'template-string': {
    pattern: /`(?:\\`|\\?[^`])*`/,
    inside: {
      interpolation: {
        pattern: /\$\{[^}]+\}/,
        inside: {
          'interpolation-punctuation': {
            pattern: /^\$\{|\}$/,
            alias: 'punctuation'
          },
          'rest': Prism.languages.javascript
        }
      },
      string: /[\s\S]+/
    }
  }
});

if (Prism.languages.markup) {
  Prism.languages.insertBefore('markup', 'tag', {
    script: {
      pattern: /<script[\w\W]*?>[\w\W]*?<\/script>/i,
      inside: {
        tag: {
          pattern: /<script[\w\W]*?>|<\/script>/i,
          inside: Prism.languages.markup.tag.inside
        },
        rest: Prism.languages.javascript
      },
      alias: 'language-javascript'
    }
  });
}

Prism.languages.js = Prism.languages.javascript;
Prism.languages.c = Prism.languages.extend('clike', {
  keyword: /\b(asm|typeof|inline|auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|int|long|register|return|short|signed|sizeof|static|struct|switch|typedef|union|unsigned|void|volatile|while)\b/,
  operator: /\-[>-]?|\+\+?|!=?|<<?=?|>>?=?|==?|&&?|\|?\||[~^%?*\/]/,
  number: /\b-?(?:0x[\da-f]+|\d*\.?\d+(?:e[+-]?\d+)?)[ful]*\b/i
});

Prism.languages.insertBefore('c', 'string', {
  macro: {
    // allow for multiline macro definitions
    // spaces after the # character compile fine with gcc
    pattern: /(^\s*)#\s*[a-z]+([^\r\n\\]|\\.|\\(?:\r\n?|\n))*/im,
    lookbehind: true,
    alias: 'property',
    inside: {
      // highlight the path of the include statement as a string
      string: {
        pattern: /(#\s*include\s*)(<.+?>|("|')(\\?.)+?\3)/,
        lookbehind: true
      }
    }
  }
});

delete Prism.languages.c['class-name'];
delete Prism.languages.c.boolean;

Prism.languages.csharp = Prism.languages.extend('clike', {
  keyword: /\b(abstract|as|async|await|base|bool|break|byte|case|catch|char|checked|class|const|continue|decimal|default|delegate|do|double|else|enum|event|explicit|extern|false|finally|fixed|float|for|foreach|goto|if|implicit|in|int|interface|internal|is|lock|long|namespace|new|null|object|operator|out|override|params|private|protected|public|readonly|ref|return|sbyte|sealed|short|sizeof|stackalloc|static|string|struct|switch|this|throw|true|try|typeof|uint|ulong|unchecked|unsafe|ushort|using|virtual|void|volatile|while|add|alias|ascending|async|await|descending|dynamic|from|get|global|group|into|join|let|orderby|partial|remove|select|set|value|var|where|yield)\b/,
  string: [
    /@("|')(\1\1|\\\1|\\?(?!\1)[\s\S])*\1/,
    /("|')(\\?.)*?\1/
  ],
  number: /\b-?(0x[\da-f]+|\d*\.?\d+)\b/i
});

Prism.languages.insertBefore('csharp', 'keyword', {
  preprocessor: {
    pattern: /(^\s*)#.*/m,
    lookbehind: true
  }
});

Prism.languages.cpp = Prism.languages.extend('c', {
  keyword: /\b(alignas|alignof|asm|auto|bool|break|case|catch|char|char16_t|char32_t|class|compl|const|constexpr|const_cast|continue|decltype|default|delete|do|double|dynamic_cast|else|enum|explicit|export|extern|float|for|friend|goto|if|inline|int|long|mutable|namespace|new|noexcept|nullptr|operator|private|protected|public|register|reinterpret_cast|return|short|signed|sizeof|static|static_assert|static_cast|struct|switch|template|this|thread_local|throw|try|typedef|typeid|typename|union|unsigned|using|virtual|void|volatile|wchar_t|while)\b/,
  boolean: /\b(true|false)\b/,
  operator: /[-+]{1,2}|!=?|<{1,2}=?|>{1,2}=?|\->|:{1,2}|={1,2}|\^|~|%|&{1,2}|\|?\||\?|\*|\/|\b(and|and_eq|bitand|bitor|not|not_eq|or|or_eq|xor|xor_eq)\b/
});

Prism.languages.insertBefore('cpp', 'keyword', {
  'class-name': {
    pattern: /(class\s+)[a-z0-9_]+/i,
    lookbehind: true
  }
});
Prism.languages.java = Prism.languages.extend('clike', {
  keyword: /\b(abstract|continue|for|new|switch|assert|default|goto|package|synchronized|boolean|do|if|private|this|break|double|implements|protected|throw|byte|else|import|public|throws|case|enum|instanceof|return|transient|catch|extends|int|short|try|char|final|interface|static|void|class|finally|long|strictfp|volatile|const|float|native|super|while)\b/,
  number: /\b0b[01]+\b|\b0x[\da-f]*\.?[\da-fp\-]+\b|\b\d*\.?\d+(?:e[+-]?\d+)?[df]?\b/i,
  operator: {
    pattern: /(^|[^.])(?:\+[+=]?|-[-=]?|!=?|<<?=?|>>?>?=?|==?|&[&=]?|\|[|=]?|\*=?|\/=?|%=?|\^=?|[?:~])/m,
    lookbehind: true
  }
});
/**
 * Original by Aaron Harun: http://aahacreative.com/2012/07/31/php-syntax-highlighting-prism/
 * Modified by Miles Johnson: http://milesj.me
 *
 * Supports the following:
 *  - Extends clike syntax
 *  - Support for PHP 5.3+ (namespaces, traits, generators, etc)
 *  - Smarter constant and function matching
 *
 * Adds the following new token classes:
 *  constant, delimiter, variable, function, package
 */

Prism.languages.php = Prism.languages.extend('clike', {
  keyword: /\b(and|or|xor|array|as|break|case|cfunction|class|const|continue|declare|default|die|do|else|elseif|enddeclare|endfor|endforeach|endif|endswitch|endwhile|extends|for|foreach|function|include|include_once|global|if|new|return|static|switch|use|require|require_once|var|while|abstract|interface|public|implements|private|protected|parent|throw|null|echo|print|trait|namespace|final|yield|goto|instanceof|finally|try|catch)\b/i,
  constant: /\b[A-Z0-9_]{2,}\b/,
  comment: {
    pattern: /(^|[^\\])(?:\/\*[\w\W]*?\*\/|\/\/.*)/,
    lookbehind: true
  }
});

// Shell-like comments are matched after strings, because they are less
// common than strings containing hashes...
Prism.languages.insertBefore('php', 'class-name', {
  'shell-comment': {
    pattern: /(^|[^\\])#.*/,
    lookbehind: true,
    alias: 'comment'
  }
});

Prism.languages.insertBefore('php', 'keyword', {
  delimiter: /\?>|<\?(?:php)?/i,
  variable: /\$\w+\b/i,
  package: {
    pattern: /(\\|namespace\s+|use\s+)[\w\\]+/,
    lookbehind: true,
    inside: {
      punctuation: /\\/
    }
  }
});

// Must be defined after the function pattern
Prism.languages.insertBefore('php', 'operator', {
  property: {
    pattern: /(->)[\w]+/,
    lookbehind: true
  }
});

// Add HTML support of the markup language exists
if (Prism.languages.markup) {

  // Tokenize all inline PHP blocks that are wrapped in <?php ?>
  // This allows for easy PHP + markup highlighting
  Prism.hooks.add('before-highlight', function (env) {
    if (env.language !== 'php') {
      return;
    }

    env.tokenStack = [];

    env.backupCode = env.code;
    env.code = env.code.replace(/(?:<\?php|<\?)[\w\W]*?(?:\?>)/ig, function (match) {
      env.tokenStack.push(match);

      return '{{{PHP' + env.tokenStack.length + '}}}';
    });
  });

  // Restore env.code for other plugins (e.g. line-numbers)
  Prism.hooks.add('before-insert', function (env) {
    if (env.language === 'php') {
      env.code = env.backupCode;
      delete env.backupCode;
    }
  });

  // Re-insert the tokens after highlighting
  Prism.hooks.add('after-highlight', function (env) {
    if (env.language !== 'php') {
      return;
    }

    for (let i = 0, t; t = env.tokenStack[i]; i++) {
      // The replace prevents $$, $&, $`, $', $n, $nn from being interpreted as special patterns
      env.highlightedCode = env.highlightedCode.replace('{{{PHP' + (i + 1) + '}}}', Prism.highlight(t, env.grammar, 'php').replace(/\$/g, '$$$$'));
    }

    env.element.innerHTML = env.highlightedCode;
  });

  // Wrap tokens in classes that are missing them
  Prism.hooks.add('wrap', function (env) {
    if (env.language === 'php' && env.type === 'markup') {
      env.content = env.content.replace(/(\{\{\{PHP[0-9]+\}\}\})/g, '<span class="token php">$1</span>');
    }
  });

  // Add the rules before all others
  Prism.languages.insertBefore('php', 'comment', {
    markup: {
      pattern: /<[^?]\/?(.*?)>/,
      inside: Prism.languages.markup
    },
    php: /\{\{\{PHP[0-9]+\}\}\}/
  });
}
Prism.languages.python = {
  'comment': {
    pattern: /(^|[^\\])#.*/,
    lookbehind: true
  },
  'string': /"""[\s\S]+?"""|'''[\s\S]+?'''|("|')(?:\\?.)*?\1/,
  'function': {
    pattern: /((?:^|\s)def[ \t]+)[a-zA-Z_][a-zA-Z0-9_]*(?=\()/g,
    lookbehind: true
  },
  'class-name': {
    pattern: /(\bclass\s+)[a-z0-9_]+/i,
    lookbehind: true
  },
  'keyword': /\b(?:as|assert|async|await|break|class|continue|def|del|elif|else|except|exec|finally|for|from|global|if|import|in|is|lambda|pass|print|raise|return|try|while|with|yield)\b/,
  'boolean': /\b(?:True|False)\b/,
  'number': /\b-?(?:0[bo])?(?:(?:\d|0x[\da-f])[\da-f]*\.?\d*|\.\d+)(?:e[+-]?\d+)?j?\b/i,
  'operator': /[-+%=]=?|!=|\*\*?=?|\/\/?=?|<[<=>]?|>[=>]?|[&|^~]|\b(?:or|and|not)\b/,
  'punctuation': /[{}[\];(),.:]/
};

/**
 * Original by Samuel Flores
 *
 * Adds the following new token classes:
 *  constant, builtin, variable, symbol, regex
 */
(function (Prism) {
  Prism.languages.ruby = Prism.languages.extend('clike', {
    comment: /#(?!\{[^\r\n]*?\}).*/,
    keyword: /\b(alias|and|BEGIN|begin|break|case|class|def|define_method|defined|do|each|else|elsif|END|end|ensure|false|for|if|in|module|new|next|nil|not|or|raise|redo|require|rescue|retry|return|self|super|then|throw|true|undef|unless|until|when|while|yield)\b/
  });

  const interpolation = {
    pattern: /#\{[^}]+\}/,
    inside: {
      delimiter: {
        pattern: /^#\{|\}$/,
        alias: 'tag'
      },
      rest: Prism.util.clone(Prism.languages.ruby)
    }
  };

  Prism.languages.insertBefore('ruby', 'keyword', {
    regex: [
      {
        pattern: /%r([^a-zA-Z0-9\s\{\(\[<])(?:[^\\]|\\[\s\S])*?\1[gim]{0,3}/,
        inside: {
          interpolation
        }
      },
      {
        pattern: /%r\((?:[^()\\]|\\[\s\S])*\)[gim]{0,3}/,
        inside: {
          interpolation
        }
      },
      {
        // Here we need to specifically allow interpolation
        pattern: /%r\{(?:[^#{}\\]|#(?:\{[^}]+\})?|\\[\s\S])*\}[gim]{0,3}/,
        inside: {
          interpolation
        }
      },
      {
        pattern: /%r\[(?:[^\[\]\\]|\\[\s\S])*\][gim]{0,3}/,
        inside: {
          interpolation
        }
      },
      {
        pattern: /%r<(?:[^<>\\]|\\[\s\S])*>[gim]{0,3}/,
        inside: {
          interpolation
        }
      },
      {
        pattern: /(^|[^/])\/(?!\/)(\[.+?]|\\.|[^/\r\n])+\/[gim]{0,3}(?=\s*($|[\r\n,.;})]))/,
        lookbehind: true
      }
    ],
    variable: /[@$]+[a-zA-Z_][a-zA-Z_0-9]*(?:[?!]|\b)/,
    symbol: /:[a-zA-Z_][a-zA-Z_0-9]*(?:[?!]|\b)/
  });

  Prism.languages.insertBefore('ruby', 'number', {
    builtin: /\b(Array|Bignum|Binding|Class|Continuation|Dir|Exception|FalseClass|File|Stat|File|Fixnum|Fload|Hash|Integer|IO|MatchData|Method|Module|NilClass|Numeric|Object|Proc|Range|Regexp|String|Struct|TMS|Symbol|ThreadGroup|Thread|Time|TrueClass)\b/,
    constant: /\b[A-Z][a-zA-Z_0-9]*(?:[?!]|\b)/
  });

  Prism.languages.ruby.string = [
    {
      pattern: /%[qQiIwWxs]?([^a-zA-Z0-9\s\{\(\[<])(?:[^\\]|\\[\s\S])*?\1/,
      inside: {
        interpolation
      }
    },
    {
      pattern: /%[qQiIwWxs]?\((?:[^()\\]|\\[\s\S])*\)/,
      inside: {
        interpolation
      }
    },
    {
      // Here we need to specifically allow interpolation
      pattern: /%[qQiIwWxs]?\{(?:[^#{}\\]|#(?:\{[^}]+\})?|\\[\s\S])*\}/,
      inside: {
        interpolation
      }
    },
    {
      pattern: /%[qQiIwWxs]?\[(?:[^\[\]\\]|\\[\s\S])*\]/,
      inside: {
        interpolation
      }
    },
    {
      pattern: /%[qQiIwWxs]?<(?:[^<>\\]|\\[\s\S])*>/,
      inside: {
        interpolation
      }
    },
    {
      pattern: /("|')(#\{[^}]+\}|\\(?:\r?\n|\r)|\\?.)*?\1/,
      inside: {
        interpolation
      }
    }
  ];
}(Prism));




Prism.languages.typescript = Prism.languages.extend('javascript', {
	// From JavaScript Prism keyword list and TypeScript language spec: https://github.com/Microsoft/TypeScript/blob/master/doc/spec.md#221-reserved-words
	'keyword': /\b(?:abstract|as|async|await|break|case|catch|class|const|constructor|continue|debugger|declare|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|is|keyof|let|module|namespace|new|null|of|package|private|protected|public|readonly|return|require|set|static|super|switch|this|throw|try|type|typeof|var|void|while|with|yield)\b/,
	'builtin': /\b(?:string|Function|any|number|boolean|Array|symbol|console|Promise|unknown|never)\b/,
});

Prism.languages.ts = Prism.languages.typescript;




Prism.languages.sql = {
	'comment': {
		pattern: /(^|[^\\])(?:\/\*[\s\S]*?\*\/|(?:--|\/\/|#).*)/,
		lookbehind: true
	},
	'variable': [
		{
			pattern: /@(["'`])(?:\\[\s\S]|(?!\1)[^\\])+\1/,
			greedy: true
		},
		/@[\w.$]+/
	],
	'string': {
		pattern: /(^|[^@\\])("|')(?:\\[\s\S]|(?!\2)[^\\]|\2\2)*\2/,
		greedy: true,
		lookbehind: true
	},
	'function': /\b(?:AVG|COUNT|FIRST|FORMAT|LAST|LCASE|LEN|MAX|MID|MIN|MOD|NOW|ROUND|SUM|UCASE)(?=\s*\()/i, // Should we highlight user defined functions too?
	'keyword': /\b(?:ACTION|ADD|AFTER|ALGORITHM|ALL|ALTER|ANALYZE|ANY|APPLY|AS|ASC|AUTHORIZATION|AUTO_INCREMENT|BACKUP|BDB|BEGIN|BERKELEYDB|BIGINT|BINARY|BIT|BLOB|BOOL|BOOLEAN|BREAK|BROWSE|BTREE|BULK|BY|CALL|CASCADED?|CASE|CHAIN|CHAR(?:ACTER|SET)?|CHECK(?:POINT)?|CLOSE|CLUSTERED|COALESCE|COLLATE|COLUMNS?|COMMENT|COMMIT(?:TED)?|COMPUTE|CONNECT|CONSISTENT|CONSTRAINT|CONTAINS(?:TABLE)?|CONTINUE|CONVERT|CREATE|CROSS|CURRENT(?:_DATE|_TIME|_TIMESTAMP|_USER)?|CURSOR|CYCLE|DATA(?:BASES?)?|DATE(?:TIME)?|DAY|DBCC|DEALLOCATE|DEC|DECIMAL|DECLARE|DEFAULT|DEFINER|DELAYED|DELETE|DELIMITERS?|DENY|DESC|DESCRIBE|DETERMINISTIC|DISABLE|DISCARD|DISK|DISTINCT|DISTINCTROW|DISTRIBUTED|DO|DOUBLE|DROP|DUMMY|DUMP(?:FILE)?|DUPLICATE|ELSE(?:IF)?|ENABLE|ENCLOSED|END|ENGINE|ENUM|ERRLVL|ERRORS|ESCAPED?|EXCEPT|EXEC(?:UTE)?|EXISTS|EXIT|EXPLAIN|EXTENDED|FETCH|FIELDS|FILE|FILLFACTOR|FIRST|FIXED|FLOAT|FOLLOWING|FOR(?: EACH ROW)?|FORCE|FOREIGN|FREETEXT(?:TABLE)?|FROM|FULL|FUNCTION|GEOMETRY(?:COLLECTION)?|GLOBAL|GOTO|GRANT|GROUP|HANDLER|HASH|HAVING|HOLDLOCK|HOUR|IDENTITY(?:_INSERT|COL)?|IF|IGNORE|IMPORT|INDEX|INFILE|INNER|INNODB|INOUT|INSERT|INT|INTEGER|INTERSECT|INTERVAL|INTO|INVOKER|ISOLATION|ITERATE|JOIN|KEYS?|KILL|LANGUAGE|LAST|LEAVE|LEFT|LEVEL|LIMIT|LINENO|LINES|LINESTRING|LOAD|LOCAL|LOCK|LONG(?:BLOB|TEXT)|LOOP|MATCH(?:ED)?|MEDIUM(?:BLOB|INT|TEXT)|MERGE|MIDDLEINT|MINUTE|MODE|MODIFIES|MODIFY|MONTH|MULTI(?:LINESTRING|POINT|POLYGON)|NATIONAL|NATURAL|NCHAR|NEXT|NO|NONCLUSTERED|NULLIF|NUMERIC|OFF?|OFFSETS?|ON|OPEN(?:DATASOURCE|QUERY|ROWSET)?|OPTIMIZE|OPTION(?:ALLY)?|ORDER|OUT(?:ER|FILE)?|OVER|PARTIAL|PARTITION|PERCENT|PIVOT|PLAN|POINT|POLYGON|PRECEDING|PRECISION|PREPARE|PREV|PRIMARY|PRINT|PRIVILEGES|PROC(?:EDURE)?|PUBLIC|PURGE|QUICK|RAISERROR|READS?|REAL|RECONFIGURE|REFERENCES|RELEASE|RENAME|REPEAT(?:ABLE)?|REPLACE|REPLICATION|REQUIRE|RESIGNAL|RESTORE|RESTRICT|RETURNS?|REVOKE|RIGHT|ROLLBACK|ROUTINE|ROW(?:COUNT|GUIDCOL|S)?|RTREE|RULE|SAVE(?:POINT)?|SCHEMA|SECOND|SELECT|SERIAL(?:IZABLE)?|SESSION(?:_USER)?|SET(?:USER)?|SHARE|SHOW|SHUTDOWN|SIMPLE|SMALLINT|SNAPSHOT|SOME|SONAME|SQL|START(?:ING)?|STATISTICS|STATUS|STRIPED|SYSTEM_USER|TABLES?|TABLESPACE|TEMP(?:ORARY|TABLE)?|TERMINATED|TEXT(?:SIZE)?|THEN|TIME(?:STAMP)?|TINY(?:BLOB|INT|TEXT)|TOP?|TRAN(?:SACTIONS?)?|TRIGGER|TRUNCATE|TSEQUAL|TYPES?|UNBOUNDED|UNCOMMITTED|UNDEFINED|UNION|UNIQUE|UNLOCK|UNPIVOT|UNSIGNED|UPDATE(?:TEXT)?|USAGE|USE|USER|USING|VALUES?|VAR(?:BINARY|CHAR|CHARACTER|YING)|VIEW|WAITFOR|WARNINGS|WHEN|WHERE|WHILE|WITH(?: ROLLUP|IN)?|WORK|WRITE(?:TEXT)?|YEAR)\b/i,
	'boolean': /\b(?:TRUE|FALSE|NULL)\b/i,
	'number': /\b0x[\da-f]+\b|\b\d+\.?\d*|\B\.\d+\b/i,
	'operator': /[-+*\/=%^~]|&&?|\|\|?|!=?|<(?:=>?|<|>)?|>[>=]?|\b(?:AND|BETWEEN|IN|LIKE|NOT|OR|IS|DIV|REGEXP|RLIKE|SOUNDS LIKE|XOR)\b/i,
	'punctuation': /[;[\]()`,.]/
};

Prism.languages.powershell = {
	'comment': [
		{
			pattern: /(^|[^`])<#[\s\S]*?#>/,
			lookbehind: true
		},
		{
			pattern: /(^|[^`])#.*/,
			lookbehind: true
		}
	],
	'string': [
		{
			pattern: /"(?:`[\s\S]|[^`"])*"/,
			greedy: true,
			inside: {
				'function': {
					// Allow for one level of nesting
					pattern: /(^|[^`])\$\((?:\$\(.*?\)|(?!\$\()[^\r\n)])*\)/,
					lookbehind: true,
					// Populated at end of file
					inside: {}
				}
			}
		},
		{
			pattern: /'(?:[^']|'')*'/,
			greedy: true
		}
	],
	// Matches name spaces as well as casts, attribute decorators. Force starting with letter to avoid matching array indices
	// Supports two levels of nested brackets (e.g. `[OutputType([System.Collections.Generic.List[int]])]`)
	'namespace': /\[[a-z](?:\[(?:\[[^\]]*]|[^\[\]])*]|[^\[\]])*]/i,
	'boolean': /\$(?:true|false)\b/i,
	'variable': /\$\w+\b/i,
	// Cmdlets and aliases. Aliases should come last, otherwise "write" gets preferred over "write-host" for example
	// Get-Command | ?{ $_.ModuleName -match "Microsoft.PowerShell.(Util|Core|Management)" }
	// Get-Alias | ?{ $_.ReferencedCommand.Module.Name -match "Microsoft.PowerShell.(Util|Core|Management)" }
	'function': [
		/\b(?:Add-(?:Computer|Content|History|Member|PSSnapin|Type)|Checkpoint-Computer|Clear-(?:Content|EventLog|History|Item|ItemProperty|Variable)|Compare-Object|Complete-Transaction|Connect-PSSession|ConvertFrom-(?:Csv|Json|StringData)|Convert-Path|ConvertTo-(?:Csv|Html|Json|Xml)|Copy-(?:Item|ItemProperty)|Debug-Process|Disable-(?:ComputerRestore|PSBreakpoint|PSRemoting|PSSessionConfiguration)|Disconnect-PSSession|Enable-(?:ComputerRestore|PSBreakpoint|PSRemoting|PSSessionConfiguration)|Enter-PSSession|Exit-PSSession|Export-(?:Alias|Clixml|Console|Csv|FormatData|ModuleMember|PSSession)|ForEach-Object|Format-(?:Custom|List|Table|Wide)|Get-(?:Alias|ChildItem|Command|ComputerRestorePoint|Content|ControlPanelItem|Culture|Date|Event|EventLog|EventSubscriber|FormatData|Help|History|Host|HotFix|Item|ItemProperty|Job|Location|Member|Module|Process|PSBreakpoint|PSCallStack|PSDrive|PSProvider|PSSession|PSSessionConfiguration|PSSnapin|Random|Service|TraceSource|Transaction|TypeData|UICulture|Unique|Variable|WmiObject)|Group-Object|Import-(?:Alias|Clixml|Csv|LocalizedData|Module|PSSession)|Invoke-(?:Command|Expression|History|Item|RestMethod|WebRequest|WmiMethod)|Join-Path|Limit-EventLog|Measure-(?:Command|Object)|Move-(?:Item|ItemProperty)|New-(?:Alias|Event|EventLog|Item|ItemProperty|Module|ModuleManifest|Object|PSDrive|PSSession|PSSessionConfigurationFile|PSSessionOption|PSTransportOption|Service|TimeSpan|Variable|WebServiceProxy)|Out-(?:Default|File|GridView|Host|Null|Printer|String)|Pop-Location|Push-Location|Read-Host|Receive-(?:Job|PSSession)|Register-(?:EngineEvent|ObjectEvent|PSSessionConfiguration|WmiEvent)|Remove-(?:Computer|Event|EventLog|Item|ItemProperty|Job|Module|PSBreakpoint|PSDrive|PSSession|PSSnapin|TypeData|Variable|WmiObject)|Rename-(?:Computer|Item|ItemProperty)|Reset-ComputerMachinePassword|Resolve-Path|Restart-(?:Computer|Service)|Restore-Computer|Resume-(?:Job|Service)|Save-Help|Select-(?:Object|String|Xml)|Send-MailMessage|Set-(?:Alias|Content|Date|Item|ItemProperty|Location|PSBreakpoint|PSDebug|PSSessionConfiguration|Service|StrictMode|TraceSource|Variable|WmiInstance)|Show-(?:Command|ControlPanelItem|EventLog)|Sort-Object|Split-Path|Start-(?:Job|Process|Service|Sleep|Transaction)|Stop-(?:Computer|Job|Process|Service)|Suspend-(?:Job|Service)|Tee-Object|Test-(?:ComputerSecureChannel|Connection|ModuleManifest|Path|PSSessionConfigurationFile)|Trace-Command|Unblock-File|Undo-Transaction|Unregister-(?:Event|PSSessionConfiguration)|Update-(?:FormatData|Help|List|TypeData)|Use-Transaction|Wait-(?:Event|Job|Process)|Where-Object|Write-(?:Debug|Error|EventLog|Host|Output|Progress|Verbose|Warning))\b/i,
		/\b(?:ac|cat|chdir|clc|cli|clp|clv|compare|copy|cp|cpi|cpp|cvpa|dbp|del|diff|dir|ebp|echo|epal|epcsv|epsn|erase|fc|fl|ft|fw|gal|gbp|gc|gci|gcs|gdr|gi|gl|gm|gp|gps|group|gsv|gu|gv|gwmi|iex|ii|ipal|ipcsv|ipsn|irm|iwmi|iwr|kill|lp|ls|measure|mi|mount|move|mp|mv|nal|ndr|ni|nv|ogv|popd|ps|pushd|pwd|rbp|rd|rdr|ren|ri|rm|rmdir|rni|rnp|rp|rv|rvpa|rwmi|sal|saps|sasv|sbp|sc|select|set|shcm|si|sl|sleep|sls|sort|sp|spps|spsv|start|sv|swmi|tee|trcm|type|write)\b/i
	],
	// per http://technet.microsoft.com/en-us/library/hh847744.aspx
	'keyword': /\b(?:Begin|Break|Catch|Class|Continue|Data|Define|Do|DynamicParam|Else|ElseIf|End|Exit|Filter|Finally|For|ForEach|From|Function|If|InlineScript|Parallel|Param|Process|Return|Sequence|Switch|Throw|Trap|Try|Until|Using|Var|While|Workflow)\b/i,
	'operator': {
		pattern: /(\W?)(?:!|-(eq|ne|gt|ge|lt|le|sh[lr]|not|b?(?:and|x?or)|(?:Not)?(?:Like|Match|Contains|In)|Replace|Join|is(?:Not)?|as)\b|-[-=]?|\+[+=]?|[*\/%]=?)/i,
		lookbehind: true
	},
	'punctuation': /[|{}[\];(),.]/
};


Prism.languages.perl = {
	'comment': [
		{
			// POD
			pattern: /(^\s*)=\w+[\s\S]*?=cut.*/m,
			lookbehind: true
		},
		{
			pattern: /(^|[^\\$])#.*/,
			lookbehind: true
		}
	],
	// TODO Could be nice to handle Heredoc too.
	'string': [
		// q/.../
		{
			pattern: /\b(?:q|qq|qx|qw)\s*([^a-zA-Z0-9\s{(\[<])(?:(?!\1)[^\\]|\\[\s\S])*\1/,
			greedy: true
		},
	
		// q a...a
		{
			pattern: /\b(?:q|qq|qx|qw)\s+([a-zA-Z0-9])(?:(?!\1)[^\\]|\\[\s\S])*\1/,
			greedy: true
		},
	
		// q(...)
		{
			pattern: /\b(?:q|qq|qx|qw)\s*\((?:[^()\\]|\\[\s\S])*\)/,
			greedy: true
		},
	
		// q{...}
		{
			pattern: /\b(?:q|qq|qx|qw)\s*\{(?:[^{}\\]|\\[\s\S])*\}/,
			greedy: true
		},
	
		// q[...]
		{
			pattern: /\b(?:q|qq|qx|qw)\s*\[(?:[^[\]\\]|\\[\s\S])*\]/,
			greedy: true
		},
	
		// q<...>
		{
			pattern: /\b(?:q|qq|qx|qw)\s*<(?:[^<>\\]|\\[\s\S])*>/,
			greedy: true
		},

		// "...", `...`
		{
			pattern: /("|`)(?:(?!\1)[^\\]|\\[\s\S])*\1/,
			greedy: true
		},

		// '...'
		// FIXME Multi-line single-quoted strings are not supported as they would break variables containing '
		{
			pattern: /'(?:[^'\\\r\n]|\\.)*'/,
			greedy: true
		}
	],
	'regex': [
		// m/.../
		{
			pattern: /\b(?:m|qr)\s*([^a-zA-Z0-9\s{(\[<])(?:(?!\1)[^\\]|\\[\s\S])*\1[msixpodualngc]*/,
			greedy: true
		},
	
		// m a...a
		{
			pattern: /\b(?:m|qr)\s+([a-zA-Z0-9])(?:(?!\1)[^\\]|\\[\s\S])*\1[msixpodualngc]*/,
			greedy: true
		},
	
		// m(...)
		{
			pattern: /\b(?:m|qr)\s*\((?:[^()\\]|\\[\s\S])*\)[msixpodualngc]*/,
			greedy: true
		},
	
		// m{...}
		{
			pattern: /\b(?:m|qr)\s*\{(?:[^{}\\]|\\[\s\S])*\}[msixpodualngc]*/,
			greedy: true
		},
	
		// m[...]
		{
			pattern: /\b(?:m|qr)\s*\[(?:[^[\]\\]|\\[\s\S])*\][msixpodualngc]*/,
			greedy: true
		},
	
		// m<...>
		{
			pattern: /\b(?:m|qr)\s*<(?:[^<>\\]|\\[\s\S])*>[msixpodualngc]*/,
			greedy: true
		},

		// The lookbehinds prevent -s from breaking
		// FIXME We don't handle change of separator like s(...)[...]
		// s/.../.../
		{
			pattern: /(^|[^-]\b)(?:s|tr|y)\s*([^a-zA-Z0-9\s{(\[<])(?:(?!\2)[^\\]|\\[\s\S])*\2(?:(?!\2)[^\\]|\\[\s\S])*\2[msixpodualngcer]*/,
			lookbehind: true,
			greedy: true
		},
	
		// s a...a...a
		{
			pattern: /(^|[^-]\b)(?:s|tr|y)\s+([a-zA-Z0-9])(?:(?!\2)[^\\]|\\[\s\S])*\2(?:(?!\2)[^\\]|\\[\s\S])*\2[msixpodualngcer]*/,
			lookbehind: true,
			greedy: true
		},
	
		// s(...)(...)
		{
			pattern: /(^|[^-]\b)(?:s|tr|y)\s*\((?:[^()\\]|\\[\s\S])*\)\s*\((?:[^()\\]|\\[\s\S])*\)[msixpodualngcer]*/,
			lookbehind: true,
			greedy: true
		},
	
		// s{...}{...}
		{
			pattern: /(^|[^-]\b)(?:s|tr|y)\s*\{(?:[^{}\\]|\\[\s\S])*\}\s*\{(?:[^{}\\]|\\[\s\S])*\}[msixpodualngcer]*/,
			lookbehind: true,
			greedy: true
		},
	
		// s[...][...]
		{
			pattern: /(^|[^-]\b)(?:s|tr|y)\s*\[(?:[^[\]\\]|\\[\s\S])*\]\s*\[(?:[^[\]\\]|\\[\s\S])*\][msixpodualngcer]*/,
			lookbehind: true,
			greedy: true
		},
	
		// s<...><...>
		{
			pattern: /(^|[^-]\b)(?:s|tr|y)\s*<(?:[^<>\\]|\\[\s\S])*>\s*<(?:[^<>\\]|\\[\s\S])*>[msixpodualngcer]*/,
			lookbehind: true,
			greedy: true
		},
	
		// /.../
		// The look-ahead tries to prevent two divisions on
		// the same line from being highlighted as regex.
		// This does not support multi-line regex.
		{
			pattern: /\/(?:[^\/\\\r\n]|\\.)*\/[msixpodualngc]*(?=\s*(?:$|[\r\n,.;})&|\-+*~<>!?^]|(lt|gt|le|ge|eq|ne|cmp|not|and|or|xor|x)\b))/,
			greedy: true
		}
	],

	// FIXME Not sure about the handling of ::, ', and #
	'variable': [
		// ${^POSTMATCH}
		/[&*$@%]\{\^[A-Z]+\}/,
		// $^V
		/[&*$@%]\^[A-Z_]/,
		// ${...}
		/[&*$@%]#?(?=\{)/,
		// $foo
		/[&*$@%]#?(?:(?:::)*'?(?!\d)[\w$]+)+(?:::)*/i,
		// $1
		/[&*$@%]\d+/,
		// $_, @_, %!
		// The negative lookahead prevents from breaking the %= operator
		/(?!%=)[$@%][!"#$%&'()*+,\-.\/:;<=>?@[\\\]^_`{|}~]/
	],
	'filehandle': {
		// <>, <FOO>, _
		pattern: /<(?![<=])\S*>|\b_\b/,
		alias: 'symbol'
	},
	'vstring': {
		// v1.2, 1.2.3
		pattern: /v\d+(?:\.\d+)*|\d+(?:\.\d+){2,}/,
		alias: 'string'
	},
	'function': {
		pattern: /sub [a-z0-9_]+/i,
		inside: {
			keyword: /sub/
		}
	},
	'keyword': /\b(?:any|break|continue|default|delete|die|do|else|elsif|eval|for|foreach|given|goto|if|last|local|my|next|our|package|print|redo|require|say|state|sub|switch|undef|unless|until|use|when|while)\b/,
	'number': /\b(?:0x[\dA-Fa-f](?:_?[\dA-Fa-f])*|0b[01](?:_?[01])*|(?:\d(?:_?\d)*)?\.?\d(?:_?\d)*(?:[Ee][+-]?\d+)?)\b/,
	'operator': /-[rwxoRWXOezsfdlpSbctugkTBMAC]\b|\+[+=]?|-[-=>]?|\*\*?=?|\/\/?=?|=[=~>]?|~[~=]?|\|\|?=?|&&?=?|<(?:=>?|<=?)?|>>?=?|![~=]?|[%^]=?|\.(?:=|\.\.?)?|[\\?]|\bx(?:=|\b)|\b(?:lt|gt|le|ge|eq|ne|cmp|not|and|or|xor)\b/,
	'punctuation': /[{}[\];(),:]/
};


Prism.languages.json = {
	'comment': /\/\/.*|\/\*[\s\S]*?(?:\*\/|$)/,
	'property': {
		pattern: /"(?:\\.|[^\\"\r\n])*"(?=\s*:)/,
		greedy: true
	},
	'string': {
		pattern: /"(?:\\.|[^\\"\r\n])*"(?!\s*:)/,
		greedy: true
	},
	'number': /-?\d+\.?\d*(e[+-]?\d+)?/i,
	'punctuation': /[{}[\],]/,
	'operator': /:/,
	'boolean': /\b(?:true|false)\b/,
	'null': /\bnull\b/
};

Prism.languages.jsonp = Prism.languages.json;


Prism.languages.go = Prism.languages.extend('clike', {
	'keyword': /\b(?:break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go(?:to)?|if|import|interface|map|package|range|return|select|struct|switch|type|var)\b/,
	'builtin': /\b(?:bool|byte|complex(?:64|128)|error|float(?:32|64)|rune|string|u?int(?:8|16|32|64)?|uintptr|append|cap|close|complex|copy|delete|imag|len|make|new|panic|print(?:ln)?|real|recover)\b/,
	'boolean': /\b(?:_|iota|nil|true|false)\b/,
	'operator': /[*\/%^!=]=?|\+[=+]?|-[=-]?|\|[=|]?|&(?:=|&|\^=?)?|>(?:>=?|=)?|<(?:<=?|=|-)?|:=|\.\.\./,
	'number': /(?:\b0x[a-f\d]+|(?:\b\d+\.?\d*|\B\.\d+)(?:e[-+]?\d+)?)i?/i,
	'string': {
		pattern: /(["'`])(\\[\s\S]|(?!\1)[^\\])*\1/,
		greedy: true
	}
});
delete Prism.languages.go['class-name'];

// Copied from https://github.com/jeluard/prism-clojure
Prism.languages.clojure = {
	comment: /;+.*/,
	string: /"(?:\\.|[^\\"\r\n])*"/,
	operator: /(?:::|[:|'])\b[a-z][\w*+!?-]*\b/i, //used for symbols and keywords
	keyword: {
		pattern: /([^\w+*'?-])(?:def|if|do|let|\.\.|quote|var|->>|->|fn|loop|recur|throw|try|monitor-enter|\.|new|set!|def\-|defn|defn\-|defmacro|defmulti|defmethod|defstruct|defonce|declare|definline|definterface|defprotocol|==|defrecord|>=|deftype|<=|defproject|ns|\*|\+|\-|\/|<|=|>|accessor|agent|agent-errors|aget|alength|all-ns|alter|and|append-child|apply|array-map|aset|aset-boolean|aset-byte|aset-char|aset-double|aset-float|aset-int|aset-long|aset-short|assert|assoc|await|await-for|bean|binding|bit-and|bit-not|bit-or|bit-shift-left|bit-shift-right|bit-xor|boolean|branch\?|butlast|byte|cast|char|children|class|clear-agent-errors|comment|commute|comp|comparator|complement|concat|conj|cons|constantly|cond|if-not|construct-proxy|contains\?|count|create-ns|create-struct|cycle|dec|deref|difference|disj|dissoc|distinct|doall|doc|dorun|doseq|dosync|dotimes|doto|double|down|drop|drop-while|edit|end\?|ensure|eval|every\?|false\?|ffirst|file-seq|filter|find|find-doc|find-ns|find-var|first|float|flush|for|fnseq|frest|gensym|get-proxy-class|get|hash-map|hash-set|identical\?|identity|if-let|import|in-ns|inc|index|insert-child|insert-left|insert-right|inspect-table|inspect-tree|instance\?|int|interleave|intersection|into|into-array|iterate|join|key|keys|keyword|keyword\?|last|lazy-cat|lazy-cons|left|lefts|line-seq|list\*|list|load|load-file|locking|long|loop|macroexpand|macroexpand-1|make-array|make-node|map|map-invert|map\?|mapcat|max|max-key|memfn|merge|merge-with|meta|min|min-key|name|namespace|neg\?|new|newline|next|nil\?|node|not|not-any\?|not-every\?|not=|ns-imports|ns-interns|ns-map|ns-name|ns-publics|ns-refers|ns-resolve|ns-unmap|nth|nthrest|or|parse|partial|path|peek|pop|pos\?|pr|pr-str|print|print-str|println|println-str|prn|prn-str|project|proxy|proxy-mappings|quot|rand|rand-int|range|re-find|re-groups|re-matcher|re-matches|re-pattern|re-seq|read|read-line|reduce|ref|ref-set|refer|rem|remove|remove-method|remove-ns|rename|rename-keys|repeat|replace|replicate|resolve|rest|resultset-seq|reverse|rfirst|right|rights|root|rrest|rseq|second|select|select-keys|send|send-off|seq|seq-zip|seq\?|set|short|slurp|some|sort|sort-by|sorted-map|sorted-map-by|sorted-set|special-symbol\?|split-at|split-with|str|string\?|struct|struct-map|subs|subvec|symbol|symbol\?|sync|take|take-nth|take-while|test|time|to-array|to-array-2d|tree-seq|true\?|union|up|update-proxy|val|vals|var-get|var-set|var\?|vector|vector-zip|vector\?|when|when-first|when-let|when-not|with-local-vars|with-meta|with-open|with-out-str|xml-seq|xml-zip|zero\?|zipmap|zipper)(?=[^\w+*'?-])/,
		lookbehind: true
	},
	boolean: /\b(?:true|false|nil)\b/,
	number: /\b[0-9A-Fa-f]+\b/,
	punctuation: /[{}\[\](),]/
};

Prism.languages.apacheconf = {
	'comment': /#.*/,
	'directive-inline': {
		pattern: /^(\s*)\b(?:AcceptFilter|AcceptPathInfo|AccessFileName|Action|AddAlt|AddAltByEncoding|AddAltByType|AddCharset|AddDefaultCharset|AddDescription|AddEncoding|AddHandler|AddIcon|AddIconByEncoding|AddIconByType|AddInputFilter|AddLanguage|AddModuleInfo|AddOutputFilter|AddOutputFilterByType|AddType|Alias|AliasMatch|Allow|AllowCONNECT|AllowEncodedSlashes|AllowMethods|AllowOverride|AllowOverrideList|Anonymous|Anonymous_LogEmail|Anonymous_MustGiveEmail|Anonymous_NoUserID|Anonymous_VerifyEmail|AsyncRequestWorkerFactor|AuthBasicAuthoritative|AuthBasicFake|AuthBasicProvider|AuthBasicUseDigestAlgorithm|AuthDBDUserPWQuery|AuthDBDUserRealmQuery|AuthDBMGroupFile|AuthDBMType|AuthDBMUserFile|AuthDigestAlgorithm|AuthDigestDomain|AuthDigestNonceLifetime|AuthDigestProvider|AuthDigestQop|AuthDigestShmemSize|AuthFormAuthoritative|AuthFormBody|AuthFormDisableNoStore|AuthFormFakeBasicAuth|AuthFormLocation|AuthFormLoginRequiredLocation|AuthFormLoginSuccessLocation|AuthFormLogoutLocation|AuthFormMethod|AuthFormMimetype|AuthFormPassword|AuthFormProvider|AuthFormSitePassphrase|AuthFormSize|AuthFormUsername|AuthGroupFile|AuthLDAPAuthorizePrefix|AuthLDAPBindAuthoritative|AuthLDAPBindDN|AuthLDAPBindPassword|AuthLDAPCharsetConfig|AuthLDAPCompareAsUser|AuthLDAPCompareDNOnServer|AuthLDAPDereferenceAliases|AuthLDAPGroupAttribute|AuthLDAPGroupAttributeIsDN|AuthLDAPInitialBindAsUser|AuthLDAPInitialBindPattern|AuthLDAPMaxSubGroupDepth|AuthLDAPRemoteUserAttribute|AuthLDAPRemoteUserIsDN|AuthLDAPSearchAsUser|AuthLDAPSubGroupAttribute|AuthLDAPSubGroupClass|AuthLDAPUrl|AuthMerging|AuthName|AuthnCacheContext|AuthnCacheEnable|AuthnCacheProvideFor|AuthnCacheSOCache|AuthnCacheTimeout|AuthnzFcgiCheckAuthnProvider|AuthnzFcgiDefineProvider|AuthType|AuthUserFile|AuthzDBDLoginToReferer|AuthzDBDQuery|AuthzDBDRedirectQuery|AuthzDBMType|AuthzSendForbiddenOnFailure|BalancerGrowth|BalancerInherit|BalancerMember|BalancerPersist|BrowserMatch|BrowserMatchNoCase|BufferedLogs|BufferSize|CacheDefaultExpire|CacheDetailHeader|CacheDirLength|CacheDirLevels|CacheDisable|CacheEnable|CacheFile|CacheHeader|CacheIgnoreCacheControl|CacheIgnoreHeaders|CacheIgnoreNoLastMod|CacheIgnoreQueryString|CacheIgnoreURLSessionIdentifiers|CacheKeyBaseURL|CacheLastModifiedFactor|CacheLock|CacheLockMaxAge|CacheLockPath|CacheMaxExpire|CacheMaxFileSize|CacheMinExpire|CacheMinFileSize|CacheNegotiatedDocs|CacheQuickHandler|CacheReadSize|CacheReadTime|CacheRoot|CacheSocache|CacheSocacheMaxSize|CacheSocacheMaxTime|CacheSocacheMinTime|CacheSocacheReadSize|CacheSocacheReadTime|CacheStaleOnError|CacheStoreExpired|CacheStoreNoStore|CacheStorePrivate|CGIDScriptTimeout|CGIMapExtension|CharsetDefault|CharsetOptions|CharsetSourceEnc|CheckCaseOnly|CheckSpelling|ChrootDir|ContentDigest|CookieDomain|CookieExpires|CookieName|CookieStyle|CookieTracking|CoreDumpDirectory|CustomLog|Dav|DavDepthInfinity|DavGenericLockDB|DavLockDB|DavMinTimeout|DBDExptime|DBDInitSQL|DBDKeep|DBDMax|DBDMin|DBDParams|DBDPersist|DBDPrepareSQL|DBDriver|DefaultIcon|DefaultLanguage|DefaultRuntimeDir|DefaultType|Define|DeflateBufferSize|DeflateCompressionLevel|DeflateFilterNote|DeflateInflateLimitRequestBody|DeflateInflateRatioBurst|DeflateInflateRatioLimit|DeflateMemLevel|DeflateWindowSize|Deny|DirectoryCheckHandler|DirectoryIndex|DirectoryIndexRedirect|DirectorySlash|DocumentRoot|DTracePrivileges|DumpIOInput|DumpIOOutput|EnableExceptionHook|EnableMMAP|EnableSendfile|Error|ErrorDocument|ErrorLog|ErrorLogFormat|Example|ExpiresActive|ExpiresByType|ExpiresDefault|ExtendedStatus|ExtFilterDefine|ExtFilterOptions|FallbackResource|FileETag|FilterChain|FilterDeclare|FilterProtocol|FilterProvider|FilterTrace|ForceLanguagePriority|ForceType|ForensicLog|GprofDir|GracefulShutdownTimeout|Group|Header|HeaderName|HeartbeatAddress|HeartbeatListen|HeartbeatMaxServers|HeartbeatStorage|HeartbeatStorage|HostnameLookups|IdentityCheck|IdentityCheckTimeout|ImapBase|ImapDefault|ImapMenu|Include|IncludeOptional|IndexHeadInsert|IndexIgnore|IndexIgnoreReset|IndexOptions|IndexOrderDefault|IndexStyleSheet|InputSed|ISAPIAppendLogToErrors|ISAPIAppendLogToQuery|ISAPICacheFile|ISAPIFakeAsync|ISAPILogNotSupported|ISAPIReadAheadBuffer|KeepAlive|KeepAliveTimeout|KeptBodySize|LanguagePriority|LDAPCacheEntries|LDAPCacheTTL|LDAPConnectionPoolTTL|LDAPConnectionTimeout|LDAPLibraryDebug|LDAPOpCacheEntries|LDAPOpCacheTTL|LDAPReferralHopLimit|LDAPReferrals|LDAPRetries|LDAPRetryDelay|LDAPSharedCacheFile|LDAPSharedCacheSize|LDAPTimeout|LDAPTrustedClientCert|LDAPTrustedGlobalCert|LDAPTrustedMode|LDAPVerifyServerCert|LimitInternalRecursion|LimitRequestBody|LimitRequestFields|LimitRequestFieldSize|LimitRequestLine|LimitXMLRequestBody|Listen|ListenBackLog|LoadFile|LoadModule|LogFormat|LogLevel|LogMessage|LuaAuthzProvider|LuaCodeCache|LuaHookAccessChecker|LuaHookAuthChecker|LuaHookCheckUserID|LuaHookFixups|LuaHookInsertFilter|LuaHookLog|LuaHookMapToStorage|LuaHookTranslateName|LuaHookTypeChecker|LuaInherit|LuaInputFilter|LuaMapHandler|LuaOutputFilter|LuaPackageCPath|LuaPackagePath|LuaQuickHandler|LuaRoot|LuaScope|MaxConnectionsPerChild|MaxKeepAliveRequests|MaxMemFree|MaxRangeOverlaps|MaxRangeReversals|MaxRanges|MaxRequestWorkers|MaxSpareServers|MaxSpareThreads|MaxThreads|MergeTrailers|MetaDir|MetaFiles|MetaSuffix|MimeMagicFile|MinSpareServers|MinSpareThreads|MMapFile|ModemStandard|ModMimeUsePathInfo|MultiviewsMatch|Mutex|NameVirtualHost|NoProxy|NWSSLTrustedCerts|NWSSLUpgradeable|Options|Order|OutputSed|PassEnv|PidFile|PrivilegesMode|Protocol|ProtocolEcho|ProxyAddHeaders|ProxyBadHeader|ProxyBlock|ProxyDomain|ProxyErrorOverride|ProxyExpressDBMFile|ProxyExpressDBMType|ProxyExpressEnable|ProxyFtpDirCharset|ProxyFtpEscapeWildcards|ProxyFtpListOnWildcard|ProxyHTMLBufSize|ProxyHTMLCharsetOut|ProxyHTMLDocType|ProxyHTMLEnable|ProxyHTMLEvents|ProxyHTMLExtended|ProxyHTMLFixups|ProxyHTMLInterp|ProxyHTMLLinks|ProxyHTMLMeta|ProxyHTMLStripComments|ProxyHTMLURLMap|ProxyIOBufferSize|ProxyMaxForwards|ProxyPass|ProxyPassInherit|ProxyPassInterpolateEnv|ProxyPassMatch|ProxyPassReverse|ProxyPassReverseCookieDomain|ProxyPassReverseCookiePath|ProxyPreserveHost|ProxyReceiveBufferSize|ProxyRemote|ProxyRemoteMatch|ProxyRequests|ProxySCGIInternalRedirect|ProxySCGISendfile|ProxySet|ProxySourceAddress|ProxyStatus|ProxyTimeout|ProxyVia|ReadmeName|ReceiveBufferSize|Redirect|RedirectMatch|RedirectPermanent|RedirectTemp|ReflectorHeader|RemoteIPHeader|RemoteIPInternalProxy|RemoteIPInternalProxyList|RemoteIPProxiesHeader|RemoteIPTrustedProxy|RemoteIPTrustedProxyList|RemoveCharset|RemoveEncoding|RemoveHandler|RemoveInputFilter|RemoveLanguage|RemoveOutputFilter|RemoveType|RequestHeader|RequestReadTimeout|Require|RewriteBase|RewriteCond|RewriteEngine|RewriteMap|RewriteOptions|RewriteRule|RLimitCPU|RLimitMEM|RLimitNPROC|Satisfy|ScoreBoardFile|Script|ScriptAlias|ScriptAliasMatch|ScriptInterpreterSource|ScriptLog|ScriptLogBuffer|ScriptLogLength|ScriptSock|SecureListen|SeeRequestTail|SendBufferSize|ServerAdmin|ServerAlias|ServerLimit|ServerName|ServerPath|ServerRoot|ServerSignature|ServerTokens|Session|SessionCookieName|SessionCookieName2|SessionCookieRemove|SessionCryptoCipher|SessionCryptoDriver|SessionCryptoPassphrase|SessionCryptoPassphraseFile|SessionDBDCookieName|SessionDBDCookieName2|SessionDBDCookieRemove|SessionDBDDeleteLabel|SessionDBDInsertLabel|SessionDBDPerUser|SessionDBDSelectLabel|SessionDBDUpdateLabel|SessionEnv|SessionExclude|SessionHeader|SessionInclude|SessionMaxAge|SetEnv|SetEnvIf|SetEnvIfExpr|SetEnvIfNoCase|SetHandler|SetInputFilter|SetOutputFilter|SSIEndTag|SSIErrorMsg|SSIETag|SSILastModified|SSILegacyExprParser|SSIStartTag|SSITimeFormat|SSIUndefinedEcho|SSLCACertificateFile|SSLCACertificatePath|SSLCADNRequestFile|SSLCADNRequestPath|SSLCARevocationCheck|SSLCARevocationFile|SSLCARevocationPath|SSLCertificateChainFile|SSLCertificateFile|SSLCertificateKeyFile|SSLCipherSuite|SSLCompression|SSLCryptoDevice|SSLEngine|SSLFIPS|SSLHonorCipherOrder|SSLInsecureRenegotiation|SSLOCSPDefaultResponder|SSLOCSPEnable|SSLOCSPOverrideResponder|SSLOCSPResponderTimeout|SSLOCSPResponseMaxAge|SSLOCSPResponseTimeSkew|SSLOCSPUseRequestNonce|SSLOpenSSLConfCmd|SSLOptions|SSLPassPhraseDialog|SSLProtocol|SSLProxyCACertificateFile|SSLProxyCACertificatePath|SSLProxyCARevocationCheck|SSLProxyCARevocationFile|SSLProxyCARevocationPath|SSLProxyCheckPeerCN|SSLProxyCheckPeerExpire|SSLProxyCheckPeerName|SSLProxyCipherSuite|SSLProxyEngine|SSLProxyMachineCertificateChainFile|SSLProxyMachineCertificateFile|SSLProxyMachineCertificatePath|SSLProxyProtocol|SSLProxyVerify|SSLProxyVerifyDepth|SSLRandomSeed|SSLRenegBufferSize|SSLRequire|SSLRequireSSL|SSLSessionCache|SSLSessionCacheTimeout|SSLSessionTicketKeyFile|SSLSRPUnknownUserSeed|SSLSRPVerifierFile|SSLStaplingCache|SSLStaplingErrorCacheTimeout|SSLStaplingFakeTryLater|SSLStaplingForceURL|SSLStaplingResponderTimeout|SSLStaplingResponseMaxAge|SSLStaplingResponseTimeSkew|SSLStaplingReturnResponderErrors|SSLStaplingStandardCacheTimeout|SSLStrictSNIVHostCheck|SSLUserName|SSLUseStapling|SSLVerifyClient|SSLVerifyDepth|StartServers|StartThreads|Substitute|Suexec|SuexecUserGroup|ThreadLimit|ThreadsPerChild|ThreadStackSize|TimeOut|TraceEnable|TransferLog|TypesConfig|UnDefine|UndefMacro|UnsetEnv|Use|UseCanonicalName|UseCanonicalPhysicalPort|User|UserDir|VHostCGIMode|VHostCGIPrivs|VHostGroup|VHostPrivs|VHostSecure|VHostUser|VirtualDocumentRoot|VirtualDocumentRootIP|VirtualScriptAlias|VirtualScriptAliasIP|WatchdogInterval|XBitHack|xml2EncAlias|xml2EncDefault|xml2StartParse)\b/mi,
		lookbehind: true,
		alias: 'property'
	},
	'directive-block': {
		pattern: /<\/?\b(?:AuthnProviderAlias|AuthzProviderAlias|Directory|DirectoryMatch|Else|ElseIf|Files|FilesMatch|If|IfDefine|IfModule|IfVersion|Limit|LimitExcept|Location|LocationMatch|Macro|Proxy|RequireAll|RequireAny|RequireNone|VirtualHost)\b *.*>/i,
		inside: {
			'directive-block': {
				pattern: /^<\/?\w+/,
				inside: {
					'punctuation': /^<\/?/
				},
				alias: 'tag'
			},
			'directive-block-parameter': {
				pattern: /.*[^>]/,
				inside: {
					'punctuation': /:/,
					'string': {
						pattern: /("|').*\1/,
						inside: {
							'variable': /[$%]\{?(?:\w\.?[-+:]?)+\}?/
						}
					}
				},
				alias: 'attr-value'
			},
			'punctuation': />/
		},
		alias: 'tag'
	},
	'directive-flags': {
		pattern: /\[(?:\w,?)+\]/,
		alias: 'keyword'
	},
	'string': {
		pattern: /("|').*\1/,
		inside: {
			'variable': /[$%]\{?(?:\w\.?[-+:]?)+\}?/
		}
	},
	'variable': /[$%]\{?(?:\w\.?[-+:]?)+\}?/,
	'regex': /\^?.*\$|\^.*\$?/
};

export default Prism;
