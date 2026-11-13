# Historical Tag Data

FUXA's DAQ historian stores tag values from configured devices in the project's DAQ storage. It is shared by the project, so historical values can be queried from any view. This is tag-value history, not a log of database connection events or saved database credentials.

## Enable history for tags

1. In the editor, open **Connections** and edit the tag.
2. Open the tag's options and enable **Registration Enabled**.
3. Optionally enable **Save if changed** or set **Save value interval (sec.)**, then save the tag.
4. In application settings, configure **DAQ storage** if you do not want to use the default storage.

History is collected only after registration is enabled; it does not backfill values from before that time. The historical tag picker only lists tags with registration enabled.

## Show history in multiple views

1. Create a chart in the project's chart configuration and add lines for the tags you want.
2. Add a **Chart** control to a view and select that chart.
3. Set the chart type to **History** and choose its default time range.
4. Add another Chart control to another view and select the same saved chart.

Chart definitions are project-wide, so the same set of historical tags can be reused without rebuilding the chart for each view.

## Query history from a view script

Client-side scripts can query the historian with `$getHistoricalTags`. In the script editor, choose **Add system function** → **Get Historical Tags** to insert the helper and select registered tags from the picker.

```javascript
const to = Date.now();
const from = to - (60 * 60 * 1000); // last hour
const data = await $getHistoricalTags(
    ['t_a95d5816-9f1e4a67'], // replace with the selected tag ID
    from,
    to
);
console.log(JSON.stringify(data));
```

`from` and `to` are Unix timestamps in milliseconds. The result is keyed by tag ID; each tag contains points with `x` (date) and `y` (value). Use this helper in client-side scripts attached to controls in any view, or use a History chart when you want FUXA to render the data directly.

The historian stores values for registered tags across the project's device connections. It uses the DAQ storage configured for the FUXA project; it does not automatically query historical tables from an external database device.
