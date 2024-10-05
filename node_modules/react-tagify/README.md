![React Tagify Promo Tweet](https://github.com/cinaaaa/react-tagify/blob/refactor/new/packages/site/src/assets/promo-tweet.png)
# ✨ React Tagify #️@
Empower your React applications with effortless <span style="color: blue">#tag</span> and  <span style="color: blue">@mention</span> support ❤️
<br />
<img src="https://img.shields.io/github/package-json/v/cinaaaa/react-tagify/master?color=green&label=Version&style=flat-square"/>

React Tagify is a powerful and pure React component for handling hashtags and mentions in your React app with ease. Give your users the ability to mention others and add tags to their content seamlessly.

For more information and demo, visit our website [here](https://react-tagify-site.vercel.app).

## Features

- 🚀 Easy to integrate
- 🎨 Customizable colors and styles
- 🔗 Supports #HashTags and @Mentions
- 📦 Lightweight

## Installation

Install the package using npm or yarn:

```bash
npm i react-tagify
```

or 

```bash
yarn add react-tagify
```
## Usage

1. Import the Tagify component:

```js
import { Tagify } from 'react-tagify';
```

2. Wrap your content with the Tagify component:

```jsx
<Tagify
  onClick={(text, type) => console.log(text, type)}
>
  <p>
    This is a #React component with help of #ReactTagify!
  </p>
</Tagify>
```

## Props

| Prop           | Type     | Default | Description                                                       |
|----------------|----------|---------|-------------------------------------------------------------------|
| children       | ReactNode |   -     | The content to be processed for tags and mentions.                |
| color         | string   | '#0073e6' | The color of the tags and mentions.                               |
| onClick        | function |   -     | A callback function that is called when a tag or mention is clicked. Receives the clicked element as an argument and type of it |
| tagStyle       | object   |   -     | The CSS style object for hashtag styling.                         |
| mentionStyle   | object   |   -     | The CSS style object for mention styling.                         |
| detectHashtags | boolean  |  true   | Enable or disable the detection of hashtags.                      |
| detectMentions | boolean  |  true   | Enable or disable the detection of mentions.                      |


## Contributing
Please feel free to contribute by submitting a pull request or reporting any issues you encounter while using this component.

## License
React Tagify is licensed under the MIT License.