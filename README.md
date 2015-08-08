# Theodo Trello
> Theodo + Trello = Trellodo ?

Ideas & Code from :
- [Scrum for Trello](https://chrome.google.com/webstore/detail/scrum-for-trello/jdbcdblgjdpmfninkoogcfpnkjmndgje)
- [CardCounter for Trello](https://chrome.google.com/webstore/detail/cardcounter-for-trello/miejdnaildjcmahbhmfngfdoficmkdhi)
- [Ultimello](https://chrome.google.com/webstore/detail/ultimello-the-features-pa/hahbfgjfimnmogoinnenhheepfcphnmm)
- [Stylish](https://chrome.google.com/webstore/detail/stylish/fjnbnpbmkenffdnngjfgmeleoegfcffe)

```
# Step 1 - Inspiration
# Install extensions
cp -r ~/.config/google-chrome/Default/Extensions/jdbcdblgjdpmfninkoogcfpnkjmndgje scrum
cp -r ~/.config/google-chrome/Default/Extensions/miejdnaildjcmahbhmfngfdoficmkdhi card-counter
cp -r ~/.config/google-chrome/Default/Extensions/hahbfgjfimnmogoinnenhheepfcphnmm ultimello
cp -r scrum/1.92_0/* trellodo
rm -rf trellodo/_metadata
### Eventually remove extensions now

# Step 2 - Initialisation
# Go to "chrome://extensions"
# Tick "developer mode"
# Click on "Load unpacked extension..."
# Select folder "trellodo"
### TODO, find commandline: google-chrome --load-extension=trellodo // man google-chrome
```

## Quick links

- [Extensions GetStarted](https://developer.chrome.com/extensions/getstarted)
