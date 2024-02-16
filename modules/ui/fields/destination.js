import { dispatch as d3_dispatch } from 'd3-dispatch';
import { select as d3_select } from 'd3-selection';
import { drag as d3_drag } from 'd3-drag';
import { zipWith } from 'lodash-es';

import { presetManager } from '../../presets';
import { fileFetcher } from '../../core/file_fetcher';
import { t, localizer } from '../../core/localizer';
import { services } from '../../services';
import { svgIcon } from '../../svg';
import { uiTooltip } from '../tooltip';
import { uiCombobox } from '../combobox';
import { utilArrayUniq, utilGetSetValue, utilNoAuto, utilRebind, utilTotalExtent, utilUniqueDomId } from '../../util';
import { uiLengthIndicator } from '../length_indicator';


export function uiFieldDestination(field, context) {
    const dispatch = d3_dispatch('change', 'input');
    let _addInput = d3_select(null);
    // todo: var _lengthIndicator = uiLengthIndicator(context.maxCharsForTagValue());
    //let _tags;

    let _selection = d3_select(null);
    let _container = d3_select(null);
    let _destinations = [];

    const _separator = ';';
    const _subKeys = [
        'destination:ref',
        'destination:colour',
        'destination:symbol'
    ]


    function destination(selection) {
        _selection = selection;

        _container = selection.selectAll('.form-field-input-wrap')
            .data([0]);

        _container = _container.enter()
            .append('div')
            .classed('form-field-input-wrap', true)
            .classed('form-field-input-destination', true)
            .classed('form-field-input-multicombo', true) //steal styles from existing chiplist css
            .merge(_container);

        _container = _container.selectAll('.chiplist')
            .data([0]);
        _container = _container.enter()
            .append('ul')
            .classed('chiplist', true)
            .classed('full-line-chips', true)
            .on('click', function() {
                //todo: add input field
                //window.setTimeout(function() { _input.node().focus(); }, 10);
            })
            .merge(_container);

        let _inputWrap = _container.selectAll('.input-wrap')
            .data([0]);

        _inputWrap = _inputWrap.enter()
            .append('li')
            .attr('class', 'input-wrap')
            .merge(_inputWrap);

        _input = _inputWrap.selectAll('input')
            .data([0]);

        _input = _input.enter()
            .append('input')
            .attr('type', 'text')
            .attr('id', field.domId)
            .call(utilNoAuto)
            //.call(initCombo, _container)
            .attr('placeholder', t('inspector.add'))
            .on('change', addNew)
            .on('blur', addNew)
            //todo: lengthIndicator .on('input', )
            .merge(_input);

        function addNew() {
            const val = context.cleanTagValue(utilGetSetValue(_input));
            if (val.length === 0) return;

            _destinations.push({
                idx: _destinations.length, // todo:needed?
                value: val
            });
            utilGetSetValue(_input, '');
            window.setTimeout(function() { _input.node().focus(); }, 10);
            const t = {};
            t[field.key] = _destinations.map(x => x.value).join(_separator);
            dispatch.call('change', this, t);
        }

        // todo: not call it chips??
        // Render chips
        let chips = _container.selectAll('.chip')
            .data(_destinations, d => d.idx);

        chips.exit()
            .remove();

        const enter = chips.enter()
            .insert('li', '.input-wrap')
            .classed('chip', true);

        //const header = enter.append('div')
        //    .classed('header', true);
        const header = enter;

        header.append('a')
            .attr('role', 'button')
            .attr('href', '#')
            .attr('class', 'hide-toggle')
            .call(svgIcon('', 'pre-text', 'hide-toggle-icon'));

        header.append('span')
            .classed('collapsed-title', true);
        header
            .append('div')
            .classed('field_buttons', true)
            .append('a')
            .attr('role', 'button')
            .classed('remove', true);

        const detailsTable = enter.append('ul')
            .classed('rows', true);

        for (let key of [field.key].concat(_subKeys)) {
            const row = detailsTable
                .append('li')
                .classed('labeled-input', true);
                // todo: specific subtag class
            row.append('span')
                .classed('label', true)
                .text(key); //todo: translatable string
            const input = row.append('div')
                //.classed('preset-…#input-wrap', true)
                .append('input')
                .attr('type', 'text')
                .classed(`preset-destination preset-${key.replace(':', '-')}`, true)
                .call(utilNoAuto)
                .on('change', changeSubKey)
                .on('blur', changeSubKey);

            if (key === 'destination:symbol') {
                input.each(function(d) {
                    d3_select(this).call(uiCombobox(context, 'destination-symbol')
                        .data(['centre', 'station'].map(value => ({value}))));
                        //todo: bug: drop down does not open on carret click???
                })
            }


            function changeSubKey(d3_event, d) {
                var value = context.cleanTagValue(utilGetSetValue(d3_select(this)));

                var t = {};
                if (key === field.key) {
                    _destinations[d.idx].value = value;
                    t[key] = _destinations.map(x => x.value).join(_separator);
                    if (isEmptyTag(t[key])) t[key] = undefined;
                } else {
                    _destinations[d.idx][key] = value;
                    t[key] = _destinations.map(x => x[key]).join(_separator);
                    if (isEmptyTag(t[key])) t[key] = undefined;
                }
                //todo: // don't override multiple values with blank string //if (!value && typeof _tags[d] !== 'string') return;

                dispatch.call('change', this, t);
            }
        }

        chips = chips.merge(enter)
            .order()
            .classed('draggable', true)
            // todo: multi selection -> mixed class, title
            ;//todo? .attr('title', '…')

        // register drag & drop
        registerDragAndDrop(chips);

        chips.each(function(d) {
            const selection = d3_select(this);
            selection.select('span.collapsed-title').text(d =>
                d['destination:ref']
                    ? `${d.value} (${d['destination:ref']})`
                    : d.value
                    //todo: render color/symbol
            );
        });

        chips.each(function(d) {
            const selection = d3_select(this);
            const details = selection.select('ul.rows');

            utilGetSetValue(details.select(`input.preset-${field.key}`), d.value);

            _subKeys.filter(subKey => typeof d[subKey] === 'string').forEach(subKey => {
                utilGetSetValue(details.select(`input.preset-${subKey.replace(':', '-')}`), d[subKey]);
            });
        });

        chips.select('a.remove')
            .attr('href', '#')
            .on('click', remove)
            .text('×');

        chips.select('a.hide-toggle')
            .attr('href', '#')
            .on('click', function(d3_event, d) {
                const content = chips.filter(x => x.idx === d.idx);
                content.classed('expanded', !content.classed('expanded'));
                content.select('.hide-toggle-icon')
                    .attr('xlink:href', content.classed('expanded') ? '#iD-icon-down'
                        : (localizer.textDirection() === 'rtl') ? '#iD-icon-backward' : '#iD-icon-forward');
            });

        chips.select('.hide-toggle-icon')
            .attr('xlink:href', function(d) {
                const content = chips.filter(x => x.idx === d.idx);
                return content.classed('expanded') ? '#iD-icon-down'
                    : (localizer.textDirection() === 'rtl') ? '#iD-icon-backward' : '#iD-icon-forward';
            });
    }

    function remove(d3_event, d) {
        d3_event.preventDefault();
        d3_event.stopPropagation();
        var t = {};
        /*
        _subKeys.filter(subKey => _tags[subKey]).forEach(subKey => {
            let subTag = _tags[subKey].split(';');
            subTag = subTag.map((v, idx) => _multiData[idx].key === d.key ? null : v);
            t[subKey] = subTag.join(';');
        });
        var arr = _destinations.map(function(md) {
            return md.idx === d.idx ? null : md.value;
        }).filter(Boolean);
        arr = utilArrayUniq(arr);
        t[field.key] = arr.length ? arr.join(';') : undefined;
        */

        _destinations = _destinations.filter(x => x.idx !== d.idx);
        t[field.key] = _destinations.map(x => x.value).join(_separator);//todo: this needed? -> || undefined;
        if (isEmptyTag(t[field.key])) t[field.key] = undefined;
        for (const subKey of _subKeys/*.filter(subKey => _tags[subKey]) todo*/) {
            t[subKey] = _destinations.map(x => x[subKey]).join(_separator);
            if (isEmptyTag(t[subKey])) t[subKey] = undefined;
        }

        //todo: _lengthIndicator.update(t[field.key]);
        dispatch.call('change', this, t);
    }


    function registerDragAndDrop(selection) {
        //todo: merge with combo.registerDragAndDrop?? -> params: isVertical, data array, onDragEnd callback (to change `t`)
        // allow drag and drop re-ordering of chips
        var dragOrigin, targetIndex;
        selection.call(d3_drag()
            .filter(function(d3_event) {
                // don't drag (text) input elements, as this interferes with text selection
                return d3_event.target.tagName !== 'INPUT';
            })
            .on('start', function(d3_event) {
                dragOrigin = {
                    x: d3_event.x,
                    y: d3_event.y
                };
                targetIndex = null;
            })
            .on('drag', function(d3_event) {
                var x = d3_event.x - dragOrigin.x,
                    y = d3_event.y - dragOrigin.y;

                if (!d3_select(this).classed('dragging') &&
                    // don't display drag until dragging beyond a distance threshold
                    Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)) <= 5) return;

                var index = selection.nodes().indexOf(this);

                d3_select(this)
                    .classed('dragging', true);

                targetIndex = null;

                _container.selectAll('.chip')
                    .style('transform', function(d2, index2) {
                        var node = d3_select(this).node();

                        if (index === index2) {
                            return 'translate(' + x + 'px, ' + y + 'px)';
                        // move the dragged tag up the order
                        } else if (index2 > index && d3_event.y > node.offsetTop) {
                            if (targetIndex === null || index2 > targetIndex) {
                                targetIndex = index2;
                            }
                            return 'translateY(-100%)';
                        // move the dragged tag down the order
                        } else if (index2 < index && d3_event.y < node.offsetTop + node.offsetHeight) {
                            if (targetIndex === null || index2 < targetIndex) {
                                targetIndex = index2;
                            }
                            return 'translateY(100%)';
                        }
                        return null;
                    });
            })
            .on('end', function() {
                if (!d3_select(this).classed('dragging')) {
                    return;
                }
                var index = selection.nodes().indexOf(this);

                d3_select(this)
                    .classed('dragging', false);

                _container.selectAll('.chip')
                    .style('transform', null);

                if (typeof targetIndex === 'number') {
                    function moveElement(array, from, to) {
                        if (array.length <= Math.max(from, to)) {
                            array.length = Math.max(from, to) + 1;
                        }
                        const element = array[from];
                        array.splice(from, 1);
                        array.splice(to, 0, element);
                    }
                    moveElement(_destinations, index, targetIndex);

                    const originExpanded = _container.selectAll(`.chip:nth-child(${index + 1})`)
                        .classed('expanded');
                    const targetExpanded = _container.selectAll(`.chip:nth-child(${targetIndex + 1})`)
                        .classed('expanded');
                    _container.selectAll(`.chip:nth-child(${index + 1})`)
                        .classed('expanded', targetExpanded);
                    _container.selectAll(`.chip:nth-child(${targetIndex + 1})`)
                        .classed('expanded', originExpanded);

                    var t = {};

                    t[field.key] = _destinations.map(x => x.value).join(_separator);
                    if (isEmptyTag(t[field.key])) t[field.key] = undefined;
                    for (const subKey of _subKeys/*.filter(subKey => _tags[subKey]) todo???*/) {
                        t[subKey] = _destinations.map(x => x[subKey]).join(_separator);
                        if (isEmptyTag(t[subKey])) t[subKey] = undefined;
                    }

                    dispatch.call('change', this, t);
                }
                dragOrigin = undefined;
                targetIndex = undefined;
            })
        );
    }


    function isEmptyTag(s) {
        return s.split('').every(x => x === _separator);
    }


    destination.tags = function(tags) {
        //_tags = tags;

        const isMixed = Array.isArray(tags[field.key]);

        const subTags = {};
        _subKeys
            .filter(subKey => typeof tags[subKey] === 'string')
            .forEach(subKey => subTags[subKey] = tags[subKey].split(_separator));
        const destinations = (tags[field.key] || '').split(_separator);
        _destinations = zipWith(...[destinations].concat(Object.values(subTags)), (dest, ...subTag) => {
            const destination = {
                value: dest || ''
            };
            for (const tagIdx in subTag) {
                destination[Object.keys(subTags)[tagIdx]] = subTag[tagIdx];
            }
            return destination;
        }).map((x, idx) => ({idx, ...x}));

        /*
        utilGetSetValue(addInput, isMixed ? '' : tags[field.key])
            .attr('title', isMixed ? tags[field.key].filter(Boolean).join('\n') : undefined)
            .attr('placeholder', isMixed ? t('inspector.multiple_values') : field.placeholder())
            .classed('mixed', isMixed);*/

        _selection
            .call(destination);

        if (!isMixed) {
            //_lengthIndicator.update(tags[field.key]);
        }
    };


    destination.focus = function() {
        _addInput.node().focus();
    };

    return utilRebind(destination, dispatch, 'on');
}


